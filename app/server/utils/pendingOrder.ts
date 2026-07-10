import type { Pool, RowDataPacket } from 'mysql2/promise'
import { randomBytes } from 'node:crypto'
import { dbInsert, dbUpdate } from './dbWrite'
import { insertComputedOrder } from './orderCompute'
import type { OrderComputation, OrderInput } from './orderCompute'

export interface PendingPayload {
  input: OrderInput
  comp: OrderComputation
}

export interface PendingRow {
  id: number
  token: string
  customersId: number
  email: string
  payload: PendingPayload
  total: number
  status: 'pending' | 'confirmed' | 'materialized' | 'cancelled'
  ordersId: number | null
  confirmedVia: string | null
  createdAt: unknown
  confirmedAt: unknown
  materializedAt: unknown
}

function mapRow(r: RowDataPacket): PendingRow {
  let payload: PendingPayload
  try {
    payload = JSON.parse(String(r.payload))
  } catch {
    payload = { input: { items: [], shippingMethod: 'abholung', paymentMethod: 'vorkasse' }, comp: null as unknown as OrderComputation }
  }
  return {
    id: Number(r.id),
    token: String(r.token),
    customersId: Number(r.customers_id),
    email: String(r.email || ''),
    payload,
    total: Number(r.total),
    status: r.status,
    ordersId: r.orders_id != null ? Number(r.orders_id) : null,
    confirmedVia: r.confirmed_via ? String(r.confirmed_via) : null,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    materializedAt: r.materialized_at,
  }
}

export async function createPendingOrder(
  db: Pool,
  args: { customerId: number, email: string, payload: PendingPayload, total: number },
  ctx: { remoteIp?: string } = {},
): Promise<{ id: number, token: string }> {
  const token = randomBytes(32).toString('hex')
  const id = await dbInsert(db, 'koop_pending_order', {
    token,
    customers_id: args.customerId,
    email: args.email,
    payload: JSON.stringify(args.payload),
    total: args.total,
    status: 'pending',
    created_at: new Date(),
  }, { customerId: args.customerId, remoteIp: ctx.remoteIp })
  return { id, token }
}

export async function getPendingByToken(db: Pool, token: string): Promise<PendingRow | null> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM koop_pending_order WHERE token = ? LIMIT 1', [token])
  return rows[0] ? mapRow(rows[0]) : null
}

export async function getPendingById(db: Pool, id: number): Promise<PendingRow | null> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM koop_pending_order WHERE id = ? LIMIT 1', [id])
  return rows[0] ? mapRow(rows[0]) : null
}

export async function getPendingByOrderId(db: Pool, ordersId: number): Promise<PendingRow | null> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM koop_pending_order WHERE orders_id = ? LIMIT 1', [ordersId])
  return rows[0] ? mapRow(rows[0]) : null
}

/**
 * Confirm + materialize a pending order into the osCommerce tables.
 * Idempotent: an already-materialized pending returns its existing orders_id
 * without inserting again. Cancelled pendings are rejected.
 */
export async function materializePending(
  db: Pool,
  pending: PendingRow,
  via: 'link' | 'reply' | 'admin',
  ctx: { remoteIp?: string } = {},
): Promise<{ ordersId: number, alreadyDone: boolean }> {
  if (pending.status === 'cancelled') {
    throw createError({ statusCode: 409, statusMessage: 'Bestellung wurde storniert' })
  }
  if (pending.status === 'materialized' && pending.ordersId) {
    return { ordersId: pending.ordersId, alreadyDone: true }
  }
  if (!pending.payload?.comp) {
    throw createError({ statusCode: 500, statusMessage: 'Bestelldaten unvollständig' })
  }

  const ordersId = await insertComputedOrder(db, pending.payload.comp, { remoteIp: ctx.remoteIp })
  const now = new Date()

  // Scrub bank details from the retained payload — the IBAN now lives only in
  // banktransfer_iban (masked in the audit log). Limits plaintext-IBAN exposure
  // to the pending window.
  const scrubbed: PendingPayload = JSON.parse(JSON.stringify(pending.payload))
  if (scrubbed.input) delete scrubbed.input.bankDetails
  if (scrubbed.comp) delete (scrubbed.comp as { bankDetails?: unknown }).bankDetails

  await dbUpdate(db, 'koop_pending_order', { id: pending.id }, {
    status: 'materialized',
    orders_id: ordersId,
    confirmed_via: via,
    confirmed_at: now,
    materialized_at: now,
    payload: JSON.stringify(scrubbed),
  }, { customerId: pending.customersId, orderId: ordersId, remoteIp: ctx.remoteIp })

  return { ordersId, alreadyDone: false }
}

export async function cancelPending(db: Pool, pending: PendingRow, ctx: { remoteIp?: string } = {}): Promise<void> {
  if (pending.status === 'materialized') {
    throw createError({ statusCode: 409, statusMessage: 'Bereits bestätigte Bestellung kann nicht storniert werden' })
  }
  await dbUpdate(db, 'koop_pending_order', { id: pending.id }, { status: 'cancelled' },
    { customerId: pending.customersId, remoteIp: ctx.remoteIp })
}
