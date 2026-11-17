import { dbInsert } from './dbWrite'

import type { WithdrawalInput } from './validate'
import type { Pool, RowDataPacket } from 'mysql2/promise'

/**
 * Withdrawal declarations made through the withdrawal function (§ 356a BGB),
 * see database/migrations/008_koop_withdrawal.sql.
 *
 * A declaration is stored exactly as made. When the order number and the
 * address belong to the same order, the record is linked to it — the operator
 * then sees it on the order. The answer to the customer never says whether that
 * worked: it would let anyone test which order numbers belong to an address.
 */
export interface Withdrawal {
  id: number
  name: string
  email: string
  orderRef: string
  scope: 'all' | 'partial'
  items: string | null
  message: string | null
  ordersId: number | null
  customersId: number | null
  createdAt: string
}

/** The order the declaration names, if number and address match. */
async function matchOrder(
  db: Pool,
  orderRef: string,
  email: string,
): Promise<{ ordersId: number; customersId: number } | null> {
  if (!/^\d{1,10}$/.test(orderRef)) return null
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT orders_id, customers_id FROM orders
      WHERE orders_id = ? AND LOWER(customers_email_address) = ? LIMIT 1`,
    [Number(orderRef), email.toLowerCase()],
  )
  const row = rows[0]
  return row ? { ordersId: Number(row.orders_id), customersId: Number(row.customers_id) } : null
}

export async function recordWithdrawal(
  db: Pool,
  input: WithdrawalInput,
  now = new Date(),
): Promise<Withdrawal> {
  const match = await matchOrder(db, input.orderRef, input.email)
  const fields = {
    name: input.name,
    email: input.email,
    order_ref: input.orderRef,
    scope: input.scope,
    items: input.items ?? null,
    message: input.message ?? null,
    orders_id: match?.ordersId ?? null,
    customers_id: match?.customersId ?? null,
    created_at: now,
  }
  // No remoteIp in the write log either: the declaration is proven by its
  // content, time and receipt, and an address adds nothing but personal data.
  const id = await dbInsert(db, 'koop_withdrawal', fields, {
    orderId: match?.ordersId,
    customerId: match?.customersId,
  })
  return {
    id,
    name: fields.name,
    email: fields.email,
    orderRef: fields.order_ref,
    scope: fields.scope,
    items: fields.items,
    message: fields.message,
    ordersId: fields.orders_id,
    customersId: fields.customers_id,
    createdAt: now.toISOString(),
  }
}

function mapRow(r: RowDataPacket): Withdrawal {
  return {
    id: Number(r.id),
    name: String(r.name),
    email: String(r.email),
    orderRef: String(r.order_ref),
    scope: r.scope === 'partial' ? 'partial' : 'all',
    items: r.items == null ? null : String(r.items),
    message: r.message == null ? null : String(r.message),
    ordersId: r.orders_id == null ? null : Number(r.orders_id),
    customersId: r.customers_id == null ? null : Number(r.customers_id),
    createdAt: new Date(r.created_at as string).toISOString(),
  }
}

/** Newest first, for the admin list. */
export async function listWithdrawals(
  db: Pool,
  page: number,
  limit: number,
): Promise<{ total: number; withdrawals: Withdrawal[] }> {
  const [count] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM koop_withdrawal')
  const offset = (page - 1) * limit
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM koop_withdrawal ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
  )
  return { total: Number(count[0]?.n ?? 0), withdrawals: rows.map(mapRow) }
}

/** The declarations linked to one order, oldest first. */
export async function withdrawalsForOrder(db: Pool, ordersId: number): Promise<Withdrawal[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT * FROM koop_withdrawal WHERE orders_id = ? ORDER BY created_at, id',
    [ordersId],
  )
  return rows.map(mapRow)
}
