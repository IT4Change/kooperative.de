import type { RowDataPacket } from 'mysql2/promise'
import { getQuery } from 'h3'

/**
 * Unified order list: osCommerce orders AND new-shop orders still awaiting
 * customer confirmation (koop_pending_order), merged and sorted by date via a
 * UNION. Each row carries:
 *   - kind:   'order' | 'pending'   (drives the link target and the status badge)
 *   - origin: 'alt' | 'neu'         ('alt' = came via the old shop → no confirmation)
 * The virtual status "Bestätigung ausstehend" (status filter value = 'pending')
 * extends the order lifecycle at the front.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDB()

  const statusParam = q.status != null ? String(q.status) : ''
  const isPendingFilter = statusParam === 'pending'
  const statusNum = !isPendingFilter && statusParam !== '' ? Number(statusParam) : null

  const includeOrders = !isPendingFilter
  const includePending = statusNum == null // pending drop out once a concrete osCommerce status is filtered

  const search = typeof q.q === 'string' ? q.q.trim() : ''
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
  const offset = (page - 1) * limit
  const numeric = /^\d+$/.test(search)

  // --- WHERE for the osCommerce orders part ---
  const oConds: string[] = []
  const oParams: unknown[] = []
  if (statusNum != null && !Number.isNaN(statusNum)) {
    oConds.push('o.orders_status = ?')
    oParams.push(statusNum)
  }
  if (search) {
    if (numeric) {
      oConds.push('(o.orders_id = ? OR o.customers_name LIKE ? OR o.customers_email_address LIKE ?)')
      oParams.push(Number(search), `%${search}%`, `%${search}%`)
    } else {
      oConds.push('(o.customers_name LIKE ? OR o.customers_email_address LIKE ?)')
      oParams.push(`%${search}%`, `%${search}%`)
    }
  }
  const oWhere = oConds.length ? `WHERE ${oConds.join(' AND ')}` : ''

  // --- WHERE for the pending part ---
  const pConds: string[] = ["kp.status = 'pending'"]
  const pParams: unknown[] = []
  if (search) {
    pConds.push("(kp.email LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(kp.payload, '$.comp.customer.name')) LIKE ?)")
    pParams.push(`%${search}%`, `%${search}%`)
  }
  const pWhere = `WHERE ${pConds.join(' AND ')}`

  const ordersSelect = `
    SELECT 'order' AS kind, o.orders_id AS id, o.date_purchased AS \`date\`,
           o.customers_name AS customer_name, o.customers_email_address AS email,
           o.orders_status AS status_id, os.orders_status_name AS status_name,
           o.payment_method AS payment, ot.value AS total,
           IF(kpo.id IS NULL, 'alt', 'neu') AS origin
    FROM orders o
    LEFT JOIN orders_status os ON os.orders_status_id = o.orders_status AND os.language_id = 2
    LEFT JOIN orders_total ot ON ot.orders_id = o.orders_id AND ot.class = 'ot_total'
    LEFT JOIN koop_pending_order kpo ON kpo.orders_id = o.orders_id
    ${oWhere}`
  const pendingSelect = `
    SELECT 'pending' AS kind, kp.id AS id, kp.created_at AS \`date\`,
           JSON_UNQUOTE(JSON_EXTRACT(kp.payload, '$.comp.customer.name')) AS customer_name, kp.email AS email,
           0 AS status_id, 'Bestätigung ausstehend' AS status_name,
           JSON_UNQUOTE(JSON_EXTRACT(kp.payload, '$.comp.payment.label')) AS payment, kp.total AS total,
           'neu' AS origin
    FROM koop_pending_order kp
    ${pWhere}`

  const parts: string[] = []
  const params: unknown[] = []
  if (includeOrders) { parts.push(ordersSelect); params.push(...oParams) }
  if (includePending) { parts.push(pendingSelect); params.push(...pParams) }

  // --- counts ---
  let total = 0
  if (includeOrders) {
    const [c] = await db.execute<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM orders o ${oWhere}`, oParams)
    total += Number(c[0]?.c || 0)
  }
  if (includePending) {
    const [c] = await db.execute<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM koop_pending_order kp ${pWhere}`, pParams)
    total += Number(c[0]?.c || 0)
  }

  const union = parts.join(' UNION ALL ')
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM (${union}) t ORDER BY t.\`date\` DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  )

  return {
    total,
    page,
    limit,
    orders: rows.map(r => ({
      kind: String(r.kind),
      id: Number(r.id),
      customerName: String(r.customer_name || ''),
      email: String(r.email || ''),
      datePurchased: r.date,
      statusId: Number(r.status_id),
      statusName: r.status_name ? String(r.status_name) : null,
      paymentMethod: String(r.payment || ''),
      total: r.total != null ? Number(r.total) : null,
      origin: String(r.origin || 'alt'),
    })),
  }
})
