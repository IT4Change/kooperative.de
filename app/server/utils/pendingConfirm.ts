import type { Pool } from 'mysql2/promise'
import type { H3Event } from 'h3'
import { materializePending } from './pendingOrder'
import type { PendingRow } from './pendingOrder'
import { sendAndLogOrderMail } from './orderMailLog'
import { buildCustomerConfirmed, buildAdminConfirmed } from './pendingMail'
import { reviewLink, adminOrderLink } from './links'
import { MAIL_OPERATOR } from './mailer'

/**
 * Confirm a pending order (materialize into osCommerce) and send the two
 * "confirmed" mails — to the customer ("Bestätigung erhalten") and to the
 * administration ("bestätigt – bitte bearbeiten"), each with a review/admin link.
 * Idempotent: if the pending is already materialized, no new order or mails.
 */
export async function confirmPending(
  db: Pool,
  event: H3Event,
  pending: PendingRow,
  via: 'link' | 'reply' | 'admin',
  ctx: { remoteIp?: string } = {},
): Promise<{ ordersId: number, alreadyDone: boolean }> {
  const result = await materializePending(db, pending, via, ctx)
  if (result.alreadyDone) return result

  const ordersId = result.ordersId
  const comp = pending.payload.comp
  const sentBy = via === 'admin' ? 'admin' : 'system'

  const cust = buildCustomerConfirmed({ orderId: ordersId, comp, reviewUrl: reviewLink(event, pending.token) })
  await sendAndLogOrderMail(db, {
    ordersId, pendingOrderId: pending.id, direction: 'to_customer', recipient: comp.customer.email,
    mailType: 'order_confirmed', subject: cust.subject, text: cust.text, html: cust.html, sentBy,
  }, ctx)

  const adm = buildAdminConfirmed({ orderId: ordersId, comp, adminUrl: adminOrderLink(event, ordersId), via })
  await sendAndLogOrderMail(db, {
    ordersId, pendingOrderId: pending.id, direction: 'to_admin', recipient: MAIL_OPERATOR,
    mailType: 'admin_order_confirmed', subject: adm.subject, text: adm.text, html: adm.html,
    replyTo: comp.customer.email, sentBy,
  }, ctx)

  return result
}
