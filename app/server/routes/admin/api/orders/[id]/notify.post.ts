import type { RowDataPacket } from 'mysql2/promise'

/**
 * (Re)send the current-status notification mail to the customer, without
 * changing the status. Used by the operator's "Benachrichtigung erneut senden"
 * action. Recorded in koop_order_mail_log so the resend is visible in the
 * mail timeline. An optional comment can be passed along.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Bestell-ID' })
  }
  const body = await readBody(event).catch(() => ({}))
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''

  const db = useDB()
  const operator = getAdminUser(event) || 'admin'
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  const [oRows] = await db.execute<RowDataPacket[]>(
    `SELECT o.orders_id, o.orders_status, o.customers_name, o.customers_email_address, os.orders_status_name
     FROM orders o
     LEFT JOIN orders_status os ON os.orders_status_id = o.orders_status AND os.language_id = 2
     WHERE o.orders_id = ? LIMIT 1`,
    [id],
  )
  const order = oRows[0]
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Bestellung nicht gefunden' })

  const email = String(order.customers_email_address || '')
  if (!email) throw createError({ statusCode: 400, statusMessage: 'Keine E-Mail-Adresse hinterlegt' })

  const statusId = Number(order.orders_status)
  const statusName = order.orders_status_name ? String(order.orders_status_name) : `Status ${statusId}`

  const m = buildStatusMail({
    orderId: id,
    customerName: String(order.customers_name || ''),
    statusName,
    comment,
  })
  const mail = await sendAndLogOrderMail(db, {
    ordersId: id,
    direction: 'to_customer',
    recipient: email,
    mailType: 'status_notification_resend',
    relatedStatusId: statusId,
    subject: m.subject,
    text: m.text,
    html: m.html,
    sentBy: operator,
  }, { remoteIp })

  return { ok: mail.status === 'sent', mail }
})
