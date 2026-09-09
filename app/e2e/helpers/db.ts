import { createPool } from 'mysql2/promise'

import type { Pool, RowDataPacket } from 'mysql2/promise'

/**
 * Direct database access for the assertions the UI cannot make. The whole point
 * of the full-stack suite is to prove that what the shop shows and what ends up
 * in the osCommerce tables are the same thing — that needs a second pair of eyes
 * on the data, not another screen reading.
 */
let pool: Pool | null = null

function db(): Pool {
  pool ??= createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? 'koop',
    password: process.env.DB_PASSWORD ?? 'koop',
    database: process.env.DB_DATABASE ?? 'kooperative',
    connectionLimit: 2,
  })
  return pool
}

export async function closeDb(): Promise<void> {
  await pool?.end()
  pool = null
}

export async function query<T extends RowDataPacket>(sql: string, params: unknown[] = []) {
  const [rows] = await db().execute<T[]>(sql, params)
  return rows
}

export interface PendingRow extends RowDataPacket {
  id: number
  token: string
  email: string
  total: string
  status: string
  orders_id: number | null
  payload: string
}

/** The pending order most recently created for an address. */
export async function latestPending(email: string): Promise<PendingRow | undefined> {
  const rows = await query<PendingRow>(
    'SELECT * FROM koop_pending_order WHERE email = ? ORDER BY id DESC LIMIT 1',
    [email],
  )
  return rows[0]
}

export interface OrderRow extends RowDataPacket {
  orders_id: number
  customers_name: string
  customers_email_address: string
  orders_status: number
  payment_method: string
}

export async function orderById(id: number): Promise<OrderRow | undefined> {
  const rows = await query<OrderRow>('SELECT * FROM orders WHERE orders_id = ? LIMIT 1', [id])
  return rows[0]
}

export async function orderProducts(id: number) {
  return query<
    RowDataPacket & { products_name: string; products_quantity: number; final_price: string }
  >('SELECT * FROM orders_products WHERE orders_id = ? ORDER BY orders_products_id', [id])
}

export async function orderTotals(id: number) {
  return query<RowDataPacket & { class: string; title: string; value: string; sort_order: number }>(
    'SELECT * FROM orders_total WHERE orders_id = ? ORDER BY sort_order',
    [id],
  )
}

export async function orderStatusHistory(id: number) {
  return query<RowDataPacket & { orders_status_id: number; comments: string }>(
    'SELECT * FROM orders_status_history WHERE orders_id = ? ORDER BY orders_status_history_id',
    [id],
  )
}

export async function mailLog(where: { orderId?: number; pendingId?: number }) {
  const column = where.orderId != null ? 'orders_id' : 'pending_order_id'
  const value = where.orderId ?? where.pendingId
  return query<
    RowDataPacket & { mail_type: string; direction: string; recipient: string; subject: string }
  >(`SELECT * FROM koop_order_mail_log WHERE ${column} = ? ORDER BY id`, [value])
}

export async function countCustomers(email: string): Promise<number> {
  // COUNT(*) is a BIGINT — mysql2 hands those over as strings.
  const rows = await query<RowDataPacket & { c: number | string }>(
    'SELECT COUNT(*) AS c FROM customers WHERE customers_email_address = ?',
    [email],
  )
  return Number(rows[0]?.c ?? 0)
}
