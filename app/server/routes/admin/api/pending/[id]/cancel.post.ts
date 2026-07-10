import { getRouterParam } from 'h3'
import { getPendingById, cancelPending } from '../../../../../utils/pendingOrder'

/** Operator cancels a pending order (never materialized into osCommerce). */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })

  const db = useDB()
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  const pending = await getPendingById(db, id)
  if (!pending) throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })

  await cancelPending(db, pending, { remoteIp })
  return { ok: true }
})
