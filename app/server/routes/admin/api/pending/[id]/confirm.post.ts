import { confirmPending } from '../../../../../utils/pendingConfirm'
import { getPendingById } from '../../../../../utils/pendingOrder'

/**
 * Operator confirms a pending order manually (e.g. after the customer replied to
 * the mail). Materializes into osCommerce and sends the confirmed mails
 * (confirmed_via='admin').
 *
 * A reason is mandatory: releasing an order without the customer's confirmation
 * skips the very step the new shop exists for, so it has to be accountable. The
 * check lives here rather than only in the form — otherwise the requirement
 * would be a suggestion that any direct POST could ignore.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })

  const body = await readBody(event)
  const confirmNote = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!confirmNote)
    throw createError({ statusCode: 400, statusMessage: 'Bitte eine Begründung angeben' })

  const db = useDB()
  const remoteIp = getRequestIP(event, { xForwardedFor: true })

  const pending = await getPendingById(db, id)
  if (!pending) throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })

  const { ordersId, alreadyDone } = await confirmPending(db, event, pending, 'admin', {
    remoteIp,
    confirmNote,
  })
  return { ok: true, orderId: ordersId, alreadyConfirmed: alreadyDone }
})
