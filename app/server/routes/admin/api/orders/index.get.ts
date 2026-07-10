import type { Pool, RowDataPacket } from 'mysql2/promise'
import { getQuery } from 'h3'

/**
 * Unified order list: osCommerce orders AND new-shop orders still awaiting
 * customer confirmation (koop_pending_order), merged and sorted by date via a
 * UNION. Each row carries:
 *   - kind:   'order' | 'pending'   (drives the link target and the status badge)
 *   - origin: 'alt' | 'neu'         ('alt' = came via the old shop → no confirmation)
 *
 * Resilient by design: if koop_pending_order is absent (migrations not yet run
 * on this DB) the endpoint degrades to an osCommerce-only list (origin 'alt',
 * no pending) instead of failing. No JSON functions are used, so it also works
 * on older MySQL/MariaDB — the pending customer name/payment is parsed in JS.
 */

let koopPendingAvailable: boolean | null = null
async function hasKoopPending(db: Pool): Promise<boolean> {
  if (koopPendingAvailable === true) return true // cache the positive result
  try {
    await db.execute('SELECT 1 FROM koop_pending_order LIMIT 1')
    koopPendingAvailable = true
  } catch {
    koopPendingAvailable = false
  }
  return koopPendingAvailable
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDB()
  const koopReady = await hasKoopPending(db)

  // Status filter — supports combining multiple statuses:
  //   absent → default: active only (hides completed = Versendet/status 3)
  //   'all' → everything · 'none' → nothing · 'pending,1,4' → those
  const raw = q.status != null ? String(q.status).trim() : ''
  const showAll = raw === 'all'
  let tokens: string[]
  if (showAll || raw === 'none') tokens = []
  else if (raw === '') tokens = ['pending', '1', '4', '2']
  else tokens = raw.split(',').map(s => s.trim()).filter(Boolean)

  const includePending = koopReady && (showAll || tokens.includes('pending'))
  const numericStatuses = tokens.filter(t => /^\d+$/.test(t)).map(Number)
  const includeOrders = showAll || numericStatuses.length > 0

  const search = typeof q.q === 'string' ? q.q.trim() : ''
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
  const offset = (page - 1) * limit
  const numeric = /^\d+$/.test(search)

  // --- WHERE for the osCommerce orders part ---
  const oConds: string[] = []
  const oParams: unknown[] = []
  if (!showAll && numericStatuses.length > 0) {
    oConds.push(`o.orders_status IN (${numericStatuses.map(() => '?').join(',')})`)
    oParams.push(...numericStatuses)
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

  // --- WHERE for the pending part (name/payment parsed in JS, so no JSON in SQL) ---
  const pConds: string[] = ["kp.status = 'pending'"]
  const pParams: unknown[] = []
  if (search) {
    pConds.push('kp.email LIKE ?')
    pParams.push(`%${search}%`)
  }
  const pWhere = `WHERE ${pConds.join(' AND ')}`

  // origin ('neu' if the order is linked to a pending record) is only computable
  // when the koop table exists; otherwise every order is treated as old-shop.
  const originExpr = koopReady ? "IF(kpo.id IS NULL, 'alt', 'neu')" : "'alt'"
  const originJoin = koopReady ? 'LEFT JOIN koop_pending_order kpo ON kpo.orders_id = o.orders_id' : ''

  const ordersSelect = `
    SELECT 'order' AS kind, o.orders_id AS id, o.date_purchased AS \`date\`,
           o.customers_name AS customer_name, o.customers_email_address AS email,
           o.orders_status AS status_id, os.orders_status_name AS status_name,
           o.payment_method AS payment, ot.value AS total,
           ${originExpr} AS origin, NULL AS payload
    FROM orders o
    LEFT JOIN orders_status os ON os.orders_status_id = o.orders_status AND os.language_id = 2
    LEFT JOIN orders_total ot ON ot.orders_id = o.orders_id AND ot.class = 'ot_total'
    ${originJoin}
    ${oWhere}`
  const pendingSelect = `
    SELECT 'pending' AS kind, kp.id AS id, kp.created_at AS \`date\`,
           NULL AS customer_name, kp.email AS email,
           0 AS status_id, 'Bestätigung ausstehend' AS status_name,
           NULL AS payment, kp.total AS total,
           'neu' AS origin, kp.payload AS payload
    FROM koop_pending_order kp
    ${pWhere}`

  const parts: string[] = []
  const params: unknown[] = []
  if (includeOrders) { parts.push(ordersSelect); params.push(...oParams) }
  if (includePending) { parts.push(pendingSelect); params.push(...pParams) }

  // Nothing selected → empty result (avoids an empty UNION / invalid SQL).
  if (parts.length === 0) {
    return { total: 0, page, limit, orders: [] }
  }

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
    orders: rows.map((r) => {
      let customerName = r.customer_name ? String(r.customer_name) : ''
      let payment = r.payment ? String(r.payment) : ''
      // For pending rows the name/payment live in the JSON payload — parse here.
      if (r.kind === 'pending' && r.payload) {
        try {
          const p = JSON.parse(String(r.payload))
          customerName = String(p?.comp?.customer?.name || '')
          payment = String(p?.comp?.payment?.label || '')
        } catch {
          // leave blanks on malformed payload
        }
      }
      return {
        kind: String(r.kind),
        id: Number(r.id),
        customerName,
        email: String(r.email || ''),
        datePurchased: r.date,
        statusId: Number(r.status_id),
        statusName: r.status_name ? String(r.status_name) : null,
        paymentMethod: payment,
        total: r.total != null ? Number(r.total) : null,
        origin: String(r.origin || 'alt'),
      }
    }),
  }
})
