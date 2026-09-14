import { getCatalog } from '../utils/catalog'
import { weakEtag, etagMatches } from '../utils/httpCache'

import type { CatalogSnapshot } from '../utils/catalog'
import type { Product } from '~/data/products'

/** Fields only the detail page needs — see GET /api/products/[id]. */
export type ListProduct = Omit<
  Product,
  'content' | 'details' | 'metaTitle' | 'metaDescription' | 'metaKeywords'
>

function toListProduct(p: Product): ListProduct {
  const {
    content: _content,
    details: _details,
    metaTitle: _metaTitle,
    metaDescription: _metaDescription,
    metaKeywords: _metaKeywords,
    ...list
  } = p
  return list
}

interface RenderedCatalog {
  /** The snapshot this was rendered from, compared by identity — see below. */
  snapshot: CatalogSnapshot
  body: string
  etag: string
}

let rendered: RenderedCatalog | null = null

function renderCatalog(snapshot: CatalogSnapshot): RenderedCatalog {
  const { products, categories } = snapshot

  // Keep categories that either host products directly or have a descendant with products
  const usedSlugs = new Set(products.map((p) => p.category))
  const keep = new Set<string>()
  for (const used of usedSlugs) {
    let slug: string | undefined = used
    while (slug) {
      keep.add(slug)
      const idx = slug.lastIndexOf('/')
      slug = idx === -1 ? undefined : slug.slice(0, idx)
    }
  }
  const activeCategories = categories.filter((c) => keep.has(c.slug))

  // The listing renders name, price, description and images; long-form and meta
  // text is dead weight in a payload that already carries the whole catalogue.
  const body = JSON.stringify({
    products: products.map(toListProduct),
    categories: activeCategories,
  })

  return { snapshot, body, etag: weakEtag(body) }
}

/**
 * The whole listing, served from a body rendered once per catalog snapshot.
 *
 * Serialising ~1200 products costs real CPU, and the result is byte-identical
 * for every visitor until the snapshot behind it refreshes — so it is rendered
 * once and handed out as a finished string. The cache is keyed on the identity
 * of the snapshot object rather than on its timestamp: getCatalog() hands back
 * the very same object for the whole TTL (and again, unchanged, when a refresh
 * fails and it falls back to the stale one), which makes identity the exact
 * signal for "this needs re-rendering".
 *
 * The ETag hashes the body, so it survives a refresh that produced identical
 * data — a customer returning after the TTL expired still revalidates into a
 * 304 instead of re-downloading a catalogue that never changed.
 */
export default defineEventHandler(async (event) => {
  const snapshot = await getCatalog(useDB())
  if (rendered?.snapshot !== snapshot) rendered = renderCatalog(snapshot)

  setResponseHeader(event, 'etag', rendered.etag)
  // Store it, but check back before using it. The catalogue is public and
  // rarely changes, yet an edit in /admin should not sit behind a cache the
  // shop cannot reach: revalidation costs one round trip and no payload.
  setResponseHeader(event, 'cache-control', 'public, no-cache')

  if (etagMatches(getRequestHeader(event, 'if-none-match'), rendered.etag)) {
    // Deliberately not setResponseStatus(): that name resolves to h3's helper
    // under Nitro but to Nuxt's app-side composable under the Vite transform,
    // and the latter returns without doing anything when it believes it runs on
    // the client. The assignment below is what h3's helper does internally and
    // means the same thing in either environment.
    event.node.res.statusCode = 304
    return null
  }

  setResponseHeader(event, 'content-type', 'application/json;charset=utf-8')
  return rendered.body
})
