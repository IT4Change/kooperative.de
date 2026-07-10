import type { Pool, RowDataPacket } from 'mysql2/promise'
import type { Product, Category } from '~/data/products'
import { groupProducts, convertCategory, buildCategoryPaths } from './converter'
import type { DbCategory, DbProduct } from './converter'

/**
 * Loads the catalog (categories + grouped products) from the osCommerce DB.
 * Shared by GET /api/products and the order pipeline so the variant grouping
 * (and thus the meaning of variantIndex) is IDENTICAL on client and server.
 */
export async function loadCatalog(db: Pool): Promise<{ products: Product[], categories: Category[] }> {
  const [catRows] = await db.query<RowDataPacket[]>(`
    SELECT c.categories_id, c.parent_id, c.sort_order, cd.categories_name
    FROM categories c
    JOIN categories_description cd ON c.categories_id = cd.categories_id AND cd.language_id = 2
    ORDER BY c.parent_id, c.sort_order, cd.categories_name
  `)
  const dbCategories = catRows as unknown as DbCategory[]
  const paths = buildCategoryPaths(dbCategories)
  const categories = dbCategories.map(row => convertCategory(row, paths))

  const [prodRows] = await db.query<RowDataPacket[]>(`
    SELECT p.products_id, p.products_price, p.products_model,
           p.products_image,
           p.products_image_detail_1, p.products_image_detail_2, p.products_image_detail_3,
           p.products_image_detail_4, p.products_image_detail_5,
           p.products_status, p.products_tax_class_id, p.products_date_added,
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
  const products = groupProducts(prodRows as unknown as DbProduct[], paths)

  return { products, categories }
}
