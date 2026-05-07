import { dbUpdateExpr } from '../../../utils/dbWrite'

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  if (!idRaw || !/^\d+$/.test(idRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Produkt-ID' })
  }
  const productId = Number(idRaw)
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  const db = useDB()
  // Mirror the alt-shop: UPDATE products_description SET products_viewed = products_viewed + 1
  // WHERE products_id = ? AND language_id = 2
  // (German is language 2 — same constant used in our products query)
  try {
    const affected = await dbUpdateExpr(db, 'products_description',
      { products_id: productId, language_id: 2 },
      'products_viewed = products_viewed + 1',
      [],
      { remoteIp },
    )
    return { ok: true, affected }
  } catch (err) {
    console.warn(`[products/${productId}/view] increment failed:`, err)
    return { ok: false }
  }
})
