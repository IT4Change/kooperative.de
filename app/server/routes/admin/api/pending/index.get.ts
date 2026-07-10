import type { RowDataPacket } from 'mysql2/promise'

/**
 * Admin list of orders awaiting customer confirmation ("Bestätigung ausstehend").
 * These live only in koop_pending_order — not yet in the osCommerce orders table.
 */
export default defineEventHandler(async () => {
  const db = useDB()
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, email, total, status, created_at, payload
     FROM koop_pending_order
     WHERE status = 'pending'
     ORDER BY id DESC
     LIMIT 200`,
  )

  const pending = rows.map((r) => {
    let name = ''
    let itemCount = 0
    try {
      const p = JSON.parse(String(r.payload))
      name = String(p?.comp?.customer?.name || '')
      itemCount = Array.isArray(p?.comp?.lines) ? p.comp.lines.length : 0
    } catch {
      // ignore malformed payload
    }
    return {
      id: Number(r.id),
      email: String(r.email || ''),
      customerName: name,
      itemCount,
      total: Number(r.total),
      status: String(r.status),
      createdAt: r.created_at,
    }
  })

  return { total: pending.length, pending }
})
