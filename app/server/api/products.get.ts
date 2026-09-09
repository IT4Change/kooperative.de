import { getCatalog } from '../utils/catalog'

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

export default defineEventHandler(async () => {
  const db = useDB()
  const { products, categories } = await getCatalog(db)

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
  return { products: products.map(toListProduct), categories: activeCategories }
})
