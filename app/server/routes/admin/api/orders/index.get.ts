import type { RowDataPacket } from 'mysql2/promise'
import { getQuery } from 'h3'

/**
 * Order list for the admin. Read-only. Supports status filter, free-text search
 * (order id / customer name / email) and pagination.
 * The order total is joined from orders_total (class='ot_total').
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDB()

  const statusId = q.status != null && q.status !== '' ? Number(q.status) : null
  const search = typeof q.q === 'string' ? q.q.trim() : ''
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []

  if (statusId != null && !Number.isNaN(statusId)) {
    conditions.push('o.orders_status = ?')
    params.push(statusId)
  }
  if (search) {
    if (/^\d+$/.test(search)) {
      conditions.push('(o.orders_id = ? OR o.customers_name LIKE ? OR o.customers_email_address LIKE ?)')
      params.push(Number(search), `%${search}%`, `%${search}%`)
    } else {
      conditions.push('(o.customers_name LIKE ? OR o.customers_email_address LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countRows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM orders o ${where}`,
    params,
  )
  const total = Number(countRows[0]?.total || 0)

  // limit/offset are validated integers → safe to inline (avoids mysql2 LIMIT-placeholder pitfalls)
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT o.orders_id, o.customers_name, o.customers_email_address, o.date_purchased,
            o.orders_status, os.orders_status_name, o.payment_method,
            ot.value AS total
     FROM orders o
     LEFT JOIN orders_status os ON os.orders_status_id = o.orders_status AND os.language_id = 2
     LEFT JOIN orders_total ot ON ot.orders_id = o.orders_id AND ot.class = 'ot_total'
     ${where}
     ORDER BY o.orders_id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  )

  return {
    total,
    page,
    limit,
    orders: rows.map(r => ({
      id: Number(r.orders_id),
      customerName: String(r.customers_name || ''),
      email: String(r.customers_email_address || ''),
      datePurchased: r.date_purchased,
      statusId: Number(r.orders_status),
      statusName: r.orders_status_name ? String(r.orders_status_name) : null,
      paymentMethod: String(r.payment_method || ''),
      total: r.total != null ? Number(r.total) : null,
    })),
  }
})
