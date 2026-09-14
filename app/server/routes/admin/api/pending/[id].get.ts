import { getPendingById } from '../../../../utils/pendingOrder'

import type { RowDataPacket } from 'mysql2/promise'

/**
 * Admin detail of a pending (unconfirmed) order: pinned content from the payload,
 * customer/delivery, and the mail history logged for this pending order.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })

  const db = useDB()
  const pending = await getPendingById(db, id)
  if (!pending?.payload.comp)
    throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })
  const comp = pending.payload.comp

  const [mailRows] = await db.execute<RowDataPacket[]>(
    `SELECT id, direction, recipient, mail_type, subject, status, sent_by, created_at
     FROM koop_order_mail_log WHERE pending_order_id = ? ORDER BY created_at ASC, id ASC`,
    [id],
  )

  // Status graphic. While the confirmation is outstanding there is no osCommerce
  // order yet, so that part is entirely upcoming. Once the pending has been
  // materialized the order DOES exist and has a status — reading it back is what
  // makes this view agree with the order page instead of freezing the whole
  // osCommerce part at "upcoming" forever.
  const [flowStatusRows] = await db.execute<RowDataPacket[]>(
    'SELECT orders_status_id, orders_status_name FROM orders_status WHERE language_id = 2',
  )
  const statusNames = new Map<number, string>(
    flowStatusRows.map((r) => [Number(r.orders_status_id), String(r.orders_status_name)]),
  )

  let currentStatusId: number | null = null
  let history: { statusId: number; dateAdded: string | Date | null }[] = []
  if (pending.status === 'materialized' && pending.ordersId) {
    const [orderRows] = await db.execute<RowDataPacket[]>(
      'SELECT orders_status FROM orders WHERE orders_id = ? LIMIT 1',
      [pending.ordersId],
    )
    if (orderRows[0]) {
      currentStatusId = Number(orderRows[0].orders_status)
      const [historyRows] = await db.execute<RowDataPacket[]>(
        `SELECT orders_status_id, date_added FROM orders_status_history
         WHERE orders_id = ? ORDER BY date_added ASC, orders_status_history_id ASC`,
        [pending.ordersId],
      )
      history = historyRows.map((r) => ({
        statusId: Number(r.orders_status_id),
        dateAdded: r.date_added as string | Date | null,
      }))
    }
  }

  const statusFlow = buildFullFlow({
    confirmation: {
      state: pending.status === 'materialized' ? 'done' : 'current',
      visitedAt: (pending.confirmedAt as string | null) ?? null,
    },
    currentStatusId,
    statusNames,
    history,
  })

  return {
    statusFlow,
    pending: {
      id: pending.id,
      status: pending.status,
      ordersId: pending.ordersId,
      confirmedVia: pending.confirmedVia,
      confirmNote: pending.confirmNote,
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
    items: comp.lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitGross,
      lineTotal: l.lineGross,
    })),
    subtotal: comp.subtotalGross,
    shipping: { label: comp.shipping.module, price: comp.shipping.gross },
    taxRows: comp.taxRows.map((t) => ({
      description: t.description,
      total: Math.round(t.total * 100) / 100,
    })),
    payment: comp.payment.label,
    notes: comp.notes ?? '',
    total: comp.total,
    mails: mailRows.map((r) => ({
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
