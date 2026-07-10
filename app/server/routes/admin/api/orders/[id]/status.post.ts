import type { RowDataPacket } from 'mysql2/promise'

/**
 * Move an order to another status (state machine — freely operable).
 * Writes go to the shared osCommerce DB, exactly like the old admin did:
 *   - UPDATE orders.orders_status + last_modified
 *   - INSERT orders_status_history (comment + customer_notified flag)
 * Both are audited via dbWrite. If notifyCustomer is set, a status mail is sent
 * to the customer and recorded in koop_order_mail_log.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Bestell-ID' })
  }
  const body = await readBody(event)
  const statusId = Number(body?.statusId)
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''
  const notify = body?.notifyCustomer === true || body?.notifyCustomer === 'true'
  if (!Number.isInteger(statusId) || statusId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültiger Status' })
  }

  const db = useDB()
  const operator = getAdminUser(event) || 'admin'
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  const [stRows] = await db.execute<RowDataPacket[]>(
    'SELECT orders_status_name FROM orders_status WHERE orders_status_id = ? AND language_id = 2 LIMIT 1',
    [statusId],
  )
  if (!stRows[0]) throw createError({ statusCode: 400, statusMessage: 'Unbekannter Status' })
  const statusName = String(stRows[0].orders_status_name)

  const [oRows] = await db.execute<RowDataPacket[]>(
    'SELECT orders_id, customers_name, customers_email_address FROM orders WHERE orders_id = ? LIMIT 1',
    [id],
  )
  const order = oRows[0]
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Bestellung nicht gefunden' })

  const now = new Date()

  await dbUpdate(db, 'orders', { orders_id: id }, { orders_status: statusId, last_modified: now }, { orderId: id, remoteIp })

  await dbInsert(db, 'orders_status_history', {
    orders_id: id,
    orders_status_id: statusId,
    date_added: now,
    customer_notified: notify ? 1 : 0,
    comments: comment,
  }, { orderId: id, remoteIp })

  let mail: { status: 'sent' | 'failed', errorMessage: string | null } | null = null
  if (notify) {
    const m = buildStatusMail({
      orderId: id,
      customerName: String(order.customers_name || ''),
      statusName,
      comment,
    })
    mail = await sendAndLogOrderMail(db, {
      ordersId: id,
      direction: 'to_customer',
      recipient: String(order.customers_email_address || ''),
      mailType: 'status_notification',
      relatedStatusId: statusId,
      subject: m.subject,
      text: m.text,
      html: m.html,
      sentBy: operator,
    }, { remoteIp })
  }

  return { ok: true, statusId, statusName, notified: notify, mail }
})
