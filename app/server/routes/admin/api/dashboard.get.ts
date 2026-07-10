import type { RowDataPacket } from 'mysql2/promise'

/**
 * Mirrors the osCommerce admin start page (admin/index.php):
 *   - "Bestellungen" box: order count per orders_status (German, language_id=2)
 *   - "Statistik" box: customers, active products, reviews
 * Query semantics preserved 1:1 (products counted only where products_status=1;
 * status rows shown even when count is 0, because the label list is driven by
 * orders_status via LEFT JOIN).
 */
export default defineEventHandler(async () => {
  const db = useDB()

  const [statusRows] = await db.execute<RowDataPacket[]>(
    `SELECT os.orders_status_id AS id, os.orders_status_name AS name, COUNT(o.orders_id) AS count
     FROM orders_status os
     LEFT JOIN orders o ON o.orders_status = os.orders_status_id
     WHERE os.language_id = 2
     GROUP BY os.orders_status_id, os.orders_status_name
     ORDER BY os.orders_status_id`,
  )

  const [statRows] = await db.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM customers) AS customers,
       (SELECT COUNT(*) FROM products WHERE products_status = 1) AS productsActive,
       (SELECT COUNT(*) FROM reviews) AS reviews`,
  )
  const stats = statRows[0] || {}

  return {
    statuses: statusRows.map(r => ({
      id: Number(r.id),
      name: String(r.name),
      count: Number(r.count),
    })),
    stats: {
      customers: Number(stats.customers || 0),
      productsActive: Number(stats.productsActive || 0),
      reviews: Number(stats.reviews || 0),
    },
  }
})
