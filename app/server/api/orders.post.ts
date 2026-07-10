import { requireSession } from '../utils/auth'
import { parseOrder } from '../utils/validate'
import { computeOrder } from '../utils/orderCompute'
import { createPendingOrder } from '../utils/pendingOrder'
import { sendAndLogOrderMail } from '../utils/orderMailLog'
import { buildCustomerConfirmRequest, buildAdminNewPending } from '../utils/pendingMail'
import { reviewLink, adminPendingLink } from '../utils/links'
import { MAIL_OPERATOR } from '../utils/mailer'

/**
 * New-shop checkout — mail-based confirmation flow.
 * The order is NOT written to the osCommerce tables here. It is computed (prices
 * pinned) and stored as a koop_pending_order ("Bestätigung ausstehend"). The
 * customer receives a confirmation-request mail (link → review page, or reply);
 * the administration receives an "unbestätigt" info mail. The order is only
 * materialized into osCommerce once confirmed (see api/orders/confirm.post.ts and
 * the admin pending endpoints).
 */
export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const input = parseOrder(body)
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined
  const db = useDB()

  const comp = await computeOrder(db, session.customerId, input)

  const { id: pendingId, token } = await createPendingOrder(db, {
    customerId: comp.customer.customerId,
    email: comp.customer.email,
    payload: { input, comp },
    total: comp.total,
  }, { remoteIp })

  const review = reviewLink(event, token)
  const adminUrl = adminPendingLink(event, pendingId)

  // Customer: please confirm your order
  const cust = buildCustomerConfirmRequest({ pendingId, comp, reviewUrl: review })
  await sendAndLogOrderMail(db, {
    pendingOrderId: pendingId,
    direction: 'to_customer',
    recipient: comp.customer.email,
    mailType: 'order_confirmation_request',
    subject: cust.subject,
    text: cust.text,
    html: cust.html,
    sentBy: 'system',
  }, { remoteIp })

  // Administration: a new unconfirmed order has arrived
  const adm = buildAdminNewPending({ pendingId, comp, adminUrl })
  await sendAndLogOrderMail(db, {
    pendingOrderId: pendingId,
    direction: 'to_admin',
    recipient: MAIL_OPERATOR,
    mailType: 'admin_new_pending',
    subject: adm.subject,
    text: adm.text,
    html: adm.html,
    replyTo: comp.customer.email,
    sentBy: 'system',
  }, { remoteIp })

  return { ok: true, pendingId, total: comp.total }
})
