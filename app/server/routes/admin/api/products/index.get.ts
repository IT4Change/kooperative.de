import type { RowDataPacket } from 'mysql2/promise'
import { getQuery } from 'h3'

/**
 * Read-only product list for the admin. Name from products_description (German,
 * language_id = 2). Search over name / model / id; paginated.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDB()

  const search = typeof q.q === 'string' ? q.q.trim() : ''
  const onlyActive = q.active === '1'
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
  const offset = (page - 1) * limit

  const conds: string[] = []
  const params: unknown[] = []
  if (onlyActive) conds.push('p.products_status = 1')
  if (search) {
    if (/^\d+$/.test(search)) {
      conds.push('(p.products_id = ? OR pd.products_name LIKE ? OR p.products_model LIKE ?)')
      params.push(Number(search), `%${search}%`, `%${search}%`)
    } else {
      conds.push('(pd.products_name LIKE ? OR p.products_model LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const [countRows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM products p
     JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
     ${where}`,
    params,
  )
  const total = Number(countRows[0]?.total || 0)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT p.products_id, p.products_model, p.products_price, p.products_status,
            p.products_ordered, p.products_quantity, pd.products_name
     FROM products p
     JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
     ${where}
     ORDER BY p.products_id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  )

  return {
    total,
    page,
    limit,
    products: rows.map(r => ({
      id: Number(r.products_id),
      model: String(r.products_model || ''),
      name: String(r.products_name || ''),
      price: r.products_price != null ? Number(r.products_price) : null,
      active: Number(r.products_status) === 1,
      ordered: Number(r.products_ordered || 0),
      quantity: Number(r.products_quantity || 0),
    })),
  }
})
