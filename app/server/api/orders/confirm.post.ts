import { getPendingByToken } from '../../utils/pendingOrder'
import { confirmPending } from '../../utils/pendingConfirm'

/**
 * Public: customer confirms their order via the token link (review page button).
 * Materializes the pending order into osCommerce and sends the confirmed mails.
 * Idempotent — a second click returns the existing order without duplicating.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Token fehlt' })

  const db = useDB()
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  const pending = await getPendingByToken(db, token)
  if (!pending) throw createError({ statusCode: 404, statusMessage: 'Bestellung nicht gefunden' })

  const { ordersId, alreadyDone } = await confirmPending(db, event, pending, 'link', { remoteIp })
  return { ok: true, orderId: ordersId, alreadyConfirmed: alreadyDone }
})
