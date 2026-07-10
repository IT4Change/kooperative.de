import { loadCatalog } from '../utils/catalog'

export default defineEventHandler(async () => {
  const db = useDB()
  const { products, categories } = await loadCatalog(db)

  // Keep categories that either host products directly or have a descendant with products
  const usedSlugs = new Set(products.map(p => p.category))
  const keep = new Set<string>()
  for (const used of usedSlugs) {
    let slug: string | undefined = used
    while (slug) {
      keep.add(slug)
      const idx = slug.lastIndexOf('/')
      slug = idx === -1 ? undefined : slug.slice(0, idx)
    }
  }
  const activeCategories = categories.filter(c => keep.has(c.slug))

  return { products, categories: activeCategories }
})
