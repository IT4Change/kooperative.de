import { getRouterParam } from 'h3'
import { getPendingById } from '../../../../../utils/pendingOrder'
import { confirmPending } from '../../../../../utils/pendingConfirm'

/**
 * Operator confirms a pending order manually (e.g. after the customer replied to
 * the mail). Materializes into osCommerce and sends the confirmed mails
 * (confirmed_via='admin').
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })

  const db = useDB()
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  const pending = await getPendingById(db, id)
  if (!pending) throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })

  const { ordersId, alreadyDone } = await confirmPending(db, event, pending, 'admin', { remoteIp })
  return { ok: true, orderId: ordersId, alreadyConfirmed: alreadyDone }
})
