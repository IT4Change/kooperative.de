import type { RowDataPacket } from 'mysql2/promise'
import { getRouterParam } from 'h3'
import { getPendingById } from '../../../../utils/pendingOrder'

/**
 * Admin detail of a pending (unconfirmed) order: pinned content from the payload,
 * customer/delivery, and the mail history logged for this pending order.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })

  const db = useDB()
  const pending = await getPendingById(db, id)
  if (!pending || !pending.payload?.comp) throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })
  const comp = pending.payload.comp

  const [mailRows] = await db.execute<RowDataPacket[]>(
    `SELECT id, direction, recipient, mail_type, subject, status, sent_by, created_at
     FROM koop_order_mail_log WHERE pending_order_id = ? ORDER BY created_at ASC, id ASC`,
    [id],
  )

  return {
    pending: {
      id: pending.id,
      status: pending.status,
      ordersId: pending.ordersId,
      confirmedVia: pending.confirmedVia,
      createdAt: pending.createdAt,
      confirmedAt: pending.confirmedAt,
      total: pending.total,
    },
    customer: {
      id: comp.customer.customerId,
      name: comp.customer.name,
      company: comp.customer.company,
      email: comp.customer.email,
      telephone: comp.customer.telephone,
      street: comp.customer.street,
      postcode: comp.customer.postcode,
      city: comp.customer.city,
      country: comp.customer.country,
    },
    items: comp.lines.map(l => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitGross, lineTotal: l.lineGross })),
    subtotal: comp.subtotalGross,
    shipping: { label: comp.shipping.module, price: comp.shipping.gross },
    taxRows: comp.taxRows.map(t => ({ description: t.description, total: Math.round(t.total * 100) / 100 })),
    payment: comp.payment.label,
    notes: comp.notes ?? '',
    total: comp.total,
    mails: mailRows.map(r => ({
      id: Number(r.id),
      direction: String(r.direction),
      recipient: String(r.recipient || ''),
      mailType: String(r.mail_type || ''),
      subject: String(r.subject || ''),
      status: String(r.status),
      sentBy: r.sent_by ? String(r.sent_by) : null,
      createdAt: r.created_at,
    })),
  }
})
