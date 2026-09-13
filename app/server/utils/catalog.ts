import { groupProducts, convertCategory, buildCategoryPaths } from './converter'

import type { DbCategory, DbProduct } from './converter'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import type { Product, Category } from '~/data/products'

/**
 * Categories the storefront does not sell (any more). The food range has been
 * split off from the stock that is still to be sold here, so it is dropped from
 * the catalog rather than merely marked as unavailable in the UI.
 *
 * Applied to the whole subtree, and applied here rather than in the SQL query
 * or the frontend: getCatalog() is the single entry point for the listing, the
 * detail route and the order pipeline, so nothing hidden reaches any of them.
 */
const HIDDEN_CATEGORY_SLUGS = ['lebensmittel']

/** Matches the hidden slugs themselves and everything nested below them. */
function isHidden(slug: string): boolean {
  return HIDDEN_CATEGORY_SLUGS.some((hidden) => slug === hidden || slug.startsWith(`${hidden}/`))
}

/**
 * Loads the catalog (categories + grouped products) from the osCommerce DB.
 * Shared by GET /api/products and the order pipeline so the variant grouping
 * (and thus the meaning of variantIndex) is IDENTICAL on client and server.
 *
 * Prefer getCatalog() — this runs the full query unconditionally.
 */
export async function loadCatalog(
  db: Pool,
): Promise<{ products: Product[]; categories: Category[] }> {
  const [catRows] = await db.query<RowDataPacket[]>(`
    SELECT c.categories_id, c.parent_id, c.sort_order, cd.categories_name
    FROM categories c
    JOIN categories_description cd ON c.categories_id = cd.categories_id AND cd.language_id = 2
    ORDER BY c.parent_id, c.sort_order, cd.categories_name
  `)
  const dbCategories = catRows as unknown as DbCategory[]
  // Paths are still built from every row: a hidden category may sit between two
  // visible ones, and dropping it early would change the slugs below it.
  const paths = buildCategoryPaths(dbCategories)
  const categories = dbCategories
    .map((row) => convertCategory(row, paths))
    .filter((c) => !isHidden(c.slug))

  // SQL_BUFFER_RESULT materialises the result into a temporary table and lets
  // the server release the locks on products/products_description immediately,
  // instead of holding them for the whole transfer. The osCommerce tables are
  // MyISAM (table-level locks, writers have priority), so a slow read would
  // otherwise park every writer — and behind that writer, every other reader.
  const [prodRows] = await db.query<RowDataPacket[]>(`
    SELECT SQL_BUFFER_RESULT
           p.products_id, p.products_price, p.products_model,
           p.products_image,
           p.products_image_detail_1, p.products_image_detail_2, p.products_image_detail_3,
           p.products_image_detail_4, p.products_image_detail_5,
           p.products_date_added,
           COALESCE(tr.tax_rate, 0) AS tax_rate,
           pd.products_name, pd.products_description, pd.products_description2,
           pd.products_content, pd.products_sizes, pd.products_viewed,
           pd.products_head_title_tag, pd.products_head_desc_tag, pd.products_head_keywords_tag,
           ptc.categories_id AS category_id, cd.categories_name AS category_name
    FROM products p
    JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
    LEFT JOIN products_to_categories ptc ON p.products_id = ptc.products_id
    LEFT JOIN categories_description cd ON ptc.categories_id = cd.categories_id AND cd.language_id = 2
    LEFT JOIN tax_rates tr ON p.products_tax_class_id = tr.tax_class_id
    WHERE p.products_status = 1
    GROUP BY p.products_id
    ORDER BY pd.products_name
  `)
  // Filtered AFTER grouping: groupProducts() de-duplicates slugs across the whole
  // catalogue (honig, honig-2, …). Dropping rows beforehand would renumber those
  // suffixes on the products that stay, breaking existing links to them.
  const products = groupProducts(prodRows as unknown as DbProduct[], paths).filter(
    (p) => !isHidden(p.category),
  )

  return { products, categories }
}

export interface CatalogSnapshot {
  products: Product[]
  categories: Category[]
  loadedAt: number
}

const TTL = 60_000
// After a failed load, wait this long before hammering a struggling DB again.
const RETRY_AFTER_ERROR = 5_000

let snapshot: CatalogSnapshot | null = null
let inFlight: Promise<CatalogSnapshot> | null = null
let lastFailureAt = 0

/**
 * Cached catalog. The full query is expensive and identical for every visitor,
 * so it runs at most once per TTL — and, thanks to the single-flight guard,
 * concurrent requests share one query instead of each taking a pool slot.
 * If a refresh fails while a previous snapshot exists, the stale one is served:
 * an outdated catalog beats an unreachable shop.
 */
export async function getCatalog(db: Pool): Promise<CatalogSnapshot> {
  const fresh = snapshot && Date.now() - snapshot.loadedAt < TTL
  if (fresh) return snapshot!
  if (inFlight) return inFlight
  if (snapshot && Date.now() - lastFailureAt < RETRY_AFTER_ERROR) return snapshot

  inFlight = loadCatalog(db)
    .then(({ products, categories }) => {
      snapshot = { products, categories, loadedAt: Date.now() }
      return snapshot
    })
    .catch((err: unknown) => {
      lastFailureAt = Date.now()
      if (snapshot) {
        const age = Math.round((Date.now() - snapshot.loadedAt) / 1000)
        console.warn(
          `[catalog] refresh failed, serving snapshot from ${age}s ago:`,
          err?.message ?? err,
        )
        return snapshot
      }
      throw err
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

/** Testing/ops hook: drop the cached snapshot so the next call reloads. */
export function invalidateCatalog() {
  snapshot = null
  lastFailureAt = 0
}
