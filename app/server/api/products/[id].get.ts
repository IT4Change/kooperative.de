import { getCatalog } from '../../utils/catalog'

/**
 * One product with its long-form and meta text, for the detail page.
 *
 * The parameter accepts the osCommerce id or the generated slug, because both
 * URL shapes exist (/shop/747, /shop/bad-reiniger, /shop/747/bad-reiniger).
 * Slugs are derived from the whole catalogue (they are de-duplicated across
 * it), so resolving one still needs the catalogue — but it comes from the
 * cached snapshot, not from a fresh query per request.
 */
export default defineEventHandler(async (event) => {
  const ref = getRouterParam(event, 'id')
  if (!ref) throw createError({ statusCode: 400, statusMessage: 'Kein Produkt angegeben' })

  const { products, categories } = await getCatalog(useDB())
  const product = products.find((p) => p.id === ref) ?? products.find((p) => p.slug === ref)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Produkt nicht gefunden' })

  const categoryName = categories.find((c) => c.slug === product.category)?.name ?? product.category
  return { product, categoryName }
})
