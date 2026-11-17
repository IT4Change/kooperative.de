import { loadContractTerms } from './contractTerms'
import { reviewLink, adminOrderLink } from './links'
import { MAIL_OPERATOR } from './mailer'
import { sendAndLogOrderMail } from './orderMailLog'
import { buildCustomerOrderReceived, buildAdminNewOrder } from './pendingMail'
import { createPendingOrder, getPendingById, materializePending } from './pendingOrder'

import type { OrderComputation, OrderInput } from './orderCompute'
import type { H3Event } from 'h3'
import type { Pool } from 'mysql2/promise'

/**
 * New-shop checkout as a standard shop: "Zahlungspflichtig bestellen" is the
 * customer's binding offer, so the order goes straight into osCommerce
 * (status 1, "In Bearbeitung") — no confirmation round trip.
 *
 * The koop_pending_order record is still written, and materialized in the same
 * breath with via='direct'. It carries what the rest of the system already
 * relies on: the review token for the customer's mail link, the "neuer Shop"
 * origin (orders_id link) and the pinned price snapshot; materializing scrubs
 * the bank details from it exactly as for a confirmed order.
 *
 * The receipt carries the live AGB and Widerrufsbelehrung, so the customer
 * holds the contract text on a durable medium (§ 312f Abs. 2 BGB) and the
 * mail log proves which wording applied.
 *
 * Should the insert into osCommerce fail, the record stays 'pending' and shows
 * up in the admin as "Bestätigung ausstehend", where the operator can release
 * it manually — the order is not lost.
 */
export async function placeDirectOrder(
  db: Pool,
  event: H3Event,
  args: { input: OrderInput; comp: OrderComputation },
  ctx: { remoteIp?: string } = {},
): Promise<{ ordersId: number; pendingId: number }> {
  const { input, comp } = args
  const { id: pendingId, token } = await createPendingOrder(
    db,
    {
      customerId: comp.customer.customerId,
      email: comp.customer.email,
      payload: { input, comp },
      total: comp.total,
    },
    ctx,
  )

  const pending = await getPendingById(db, pendingId)
  if (!pending) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Bestellung konnte nicht gespeichert werden',
    })
  }
  const { ordersId } = await materializePending(db, pending, 'direct', ctx)

  const cust = buildCustomerOrderReceived({
    orderId: ordersId,
    comp,
    reviewUrl: reviewLink(event, token),
    terms: await loadContractTerms(db),
  })
  await sendAndLogOrderMail(
    db,
    {
      ordersId,
      pendingOrderId: pendingId,
      direction: 'to_customer',
      recipient: comp.customer.email,
      mailType: 'order_received',
      subject: cust.subject,
      text: cust.text,
      html: cust.html,
      sentBy: 'system',
    },
    ctx,
  )

  const adm = buildAdminNewOrder({
    orderId: ordersId,
    comp,
    adminUrl: adminOrderLink(event, ordersId),
  })
  await sendAndLogOrderMail(
    db,
    {
      ordersId,
      pendingOrderId: pendingId,
      direction: 'to_admin',
      recipient: MAIL_OPERATOR,
      mailType: 'admin_new_order',
      subject: adm.subject,
      text: adm.text,
      html: adm.html,
      replyTo: comp.customer.email,
      sentBy: 'system',
    },
    ctx,
  )

  return { ordersId, pendingId }
}
