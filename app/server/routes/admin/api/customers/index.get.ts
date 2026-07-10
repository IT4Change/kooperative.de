import type { RowDataPacket } from 'mysql2/promise'
import { getQuery } from 'h3'

/**
 * Customer list for the admin. Read-only in Phase 1 (editing comes later).
 * Free-text search over name / email; paginated.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDB()

  const search = typeof q.q === 'string' ? q.q.trim() : ''
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  if (search) {
    if (/^\d+$/.test(search)) {
      conditions.push('(c.customers_id = ? OR c.customers_email_address LIKE ? OR CONCAT(c.customers_firstname, \' \', c.customers_lastname) LIKE ?)')
      params.push(Number(search), `%${search}%`, `%${search}%`)
    } else {
      conditions.push('(c.customers_email_address LIKE ? OR CONCAT(c.customers_firstname, \' \', c.customers_lastname) LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countRows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM customers c ${where}`,
    params,
  )
  const total = Number(countRows[0]?.total || 0)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.customers_id, c.customers_firstname, c.customers_lastname,
            c.customers_email_address, c.customers_telephone,
            ab.entry_postcode, ab.entry_city
     FROM customers c
     LEFT JOIN address_book ab ON ab.address_book_id = c.customers_default_address_id
     ${where}
     ORDER BY c.customers_id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  )

  return {
    total,
    page,
    limit,
    customers: rows.map(r => ({
      id: Number(r.customers_id),
      name: `${r.customers_firstname || ''} ${r.customers_lastname || ''}`.trim(),
      email: String(r.customers_email_address || ''),
      telephone: String(r.customers_telephone || ''),
      city: [r.entry_postcode, r.entry_city].filter(Boolean).join(' '),
    })),
  }
})
