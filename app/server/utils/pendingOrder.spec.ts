// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../test/setup-server'
import { createMockDb } from '../../test/helpers/mock-db'

import {
  createPendingOrder,
  getPendingByToken,
  getPendingById,
  getPendingByOrderId,
  materializePending,
  cancelPending,
} from './pendingOrder'

import type { PendingRow } from './pendingOrder'

const dbInsert = vi.hoisted(() => vi.fn())
const dbUpdate = vi.hoisted(() => vi.fn())
vi.mock(import('./dbWrite'), () => ({ dbInsert, dbUpdate }))

const insertComputedOrder = vi.hoisted(() => vi.fn())
vi.mock(import('./orderCompute'), () => ({ insertComputedOrder }))

/**
 * The "confirmation pending" record: an order lives here until the customer
 * confirms it, and only then does it become a real osCommerce order.
 *
 * Two properties carry the whole flow. Materialising must be idempotent, or a
 * double-clicked confirmation link creates two orders. And the retained payload
 * must lose the plaintext IBAN once it has been moved into banktransfer_iban.
 */

const PAYLOAD = {
  input: { items: [], shippingMethod: 'abholung', paymentMethod: 'lastschrift' },
  comp: { customer: { name: 'Erika' }, bankDetails: { iban: 'DE89370400440532013000' } },
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: 12,
    token: 'a'.repeat(64),
    customers_id: 3,
    email: 'e@example.org',
    payload: JSON.stringify(PAYLOAD),
    total: '23.80',
    status: 'pending',
    orders_id: null,
    confirmed_via: null,
    created_at: '2026-01-01 10:00:00',
    confirmed_at: null,
    materialized_at: null,
    ...over,
  }
}

function pending(over: Partial<PendingRow> = {}): PendingRow {
  return {
    id: 12,
    token: 'a'.repeat(64),
    customersId: 3,
    email: 'e@example.org',
    payload: structuredClone(PAYLOAD) as PendingRow['payload'],
    total: 23.8,
    status: 'pending',
    ordersId: null,
    confirmedVia: null,
    createdAt: null,
    confirmedAt: null,
    materializedAt: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  dbInsert.mockResolvedValue(12)
  dbUpdate.mockResolvedValue(1)
  insertComputedOrder.mockResolvedValue(55)
})

describe('createPendingOrder', () => {
  it('stores the pinned payload behind a random token', async () => {
    const db = createMockDb()

    const created = await createPendingOrder(db.pool, {
      customerId: 3,
      email: 'e@example.org',
      payload: PAYLOAD as never,
      total: 23.8,
    })

    expect(created.id).toBe(12)
    // 32 random bytes as hex — guessable tokens would expose other people's orders.
    expect(created.token).toMatch(/^[0-9a-f]{64}$/)
    expect(dbInsert.mock.calls[0][2]).toMatchObject({
      token: created.token,
      customers_id: 3,
      email: 'e@example.org',
      status: 'pending',
      total: 23.8,
    })
  })

  it('serialises the payload as JSON', async () => {
    const db = createMockDb()

    await createPendingOrder(db.pool, {
      customerId: 3,
      email: 'e@example.org',
      payload: PAYLOAD as never,
      total: 1,
    })

    expect(JSON.parse(dbInsert.mock.calls[0][2].payload)).toStrictEqual(PAYLOAD)
  })

  it('issues a different token every time', async () => {
    const db = createMockDb()
    const args = { customerId: 3, email: 'e@example.org', payload: PAYLOAD as never, total: 1 }

    const [a, b] = [
      await createPendingOrder(db.pool, args),
      await createPendingOrder(db.pool, args),
    ]
    expect(a.token).not.toBe(b.token)
  })
})

describe('lookups', () => {
  it.each([
    ['token', () => getPendingByToken, 'a'.repeat(64), 'WHERE token = ?'],
    ['id', () => getPendingById, 12, 'WHERE id = ?'],
    ['order id', () => getPendingByOrderId, 55, 'WHERE orders_id = ?'],
  ])('finds a pending order by %s', async (_label, fn, arg, where) => {
    const db = createMockDb([{ match: 'koop_pending_order', rows: [row()] }])

    const found = await fn()(db.pool, arg as never)

    expect(found).toMatchObject({ id: 12, email: 'e@example.org', status: 'pending' })
    expect(db.sql(0)).toContain(where)
  })

  it('returns null when nothing matches', async () => {
    const db = createMockDb([{ match: 'koop_pending_order', rows: [] }])

    await expect(getPendingByToken(db.pool, 'nope')).resolves.toBeNull()
  })

  it('returns null for each lookup that finds nothing', async () => {
    const db = createMockDb([{ match: 'koop_pending_order', rows: [] }])

    await expect(getPendingById(db.pool, 12)).resolves.toBeNull()
    await expect(getPendingByOrderId(db.pool, 55)).resolves.toBeNull()
  })

  it('reads a confirmed row with all its optional columns filled', async () => {
    const db = createMockDb([
      {
        match: 'koop_pending_order',
        rows: [row({ status: 'materialized', orders_id: 55, confirmed_via: 'reply' })],
      },
    ])

    const found = await getPendingByToken(db.pool, 'x')

    expect(found).toMatchObject({ ordersId: 55, confirmedVia: 'reply' })
  })

  it('tolerates a row without a mail address', async () => {
    const db = createMockDb([{ match: 'koop_pending_order', rows: [row({ email: null })] }])

    const found = await getPendingByToken(db.pool, 'x')

    expect(found?.email).toBe('')
  })

  it('parses the payload back into an object', async () => {
    const db = createMockDb([{ match: 'koop_pending_order', rows: [row()] }])

    const found = await getPendingByToken(db.pool, 'x')

    expect(found?.payload.comp).toMatchObject({ customer: { name: 'Erika' } })
  })

  it('survives a payload that is not valid JSON', async () => {
    const db = createMockDb([{ match: 'koop_pending_order', rows: [row({ payload: '{broken' })] }])

    const found = await getPendingByToken(db.pool, 'x')

    // A corrupt row must not take the endpoint down; comp is null and readers guard.
    expect(found?.payload.comp).toBeNull()
    expect(found?.payload.input.items).toStrictEqual([])
  })
})

describe('materializePending', () => {
  it('inserts the osCommerce order and links it back', async () => {
    const db = createMockDb()

    const result = await materializePending(db.pool, pending(), 'link', { remoteIp: '10.0.0.1' })

    expect(result).toStrictEqual({ ordersId: 55, alreadyDone: false })
    expect(insertComputedOrder).toHaveBeenCalledWith(db.pool, PAYLOAD.comp, {
      remoteIp: '10.0.0.1',
    })
    expect(dbUpdate).toHaveBeenCalledWith(
      db.pool,
      'koop_pending_order',
      { id: 12 },
      expect.objectContaining({ status: 'materialized', orders_id: 55, confirmed_via: 'link' }),
      expect.anything(),
    )
  })

  it('does not create a second order for an already confirmed one', async () => {
    const db = createMockDb()

    const result = await materializePending(
      db.pool,
      pending({ status: 'materialized', ordersId: 55 }),
      'link',
    )

    // A double-clicked confirmation link must not duplicate the order.
    expect(result).toStrictEqual({ ordersId: 55, alreadyDone: true })
    expect(insertComputedOrder).not.toHaveBeenCalled()
  })

  it('refuses to confirm a cancelled order', async () => {
    const db = createMockDb()

    await expect(
      materializePending(db.pool, pending({ status: 'cancelled' }), 'link'),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuses when the pinned computation is missing', async () => {
    const db = createMockDb()
    const broken = pending()
    broken.payload.comp = null

    await expect(materializePending(db.pool, broken, 'link')).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Bestelldaten unvollständig',
    })
  })

  it('scrubs the bank details from the retained payload', async () => {
    const db = createMockDb()

    await materializePending(db.pool, pending(), 'link')

    const stored = JSON.parse(dbUpdate.mock.calls[0][3].payload)
    // The IBAN now lives only in banktransfer_iban; keeping a second plaintext
    // copy in the pending row would widen the exposure window for no gain.
    expect(stored.comp.bankDetails).toBeUndefined()
    expect(stored.input.bankDetails).toBeUndefined()
  })
})

describe('cancelPending', () => {
  it('marks the order cancelled', async () => {
    const db = createMockDb()

    await cancelPending(db.pool, pending())

    expect(dbUpdate).toHaveBeenCalledWith(
      db.pool,
      'koop_pending_order',
      { id: 12 },
      { status: 'cancelled' },
      expect.anything(),
    )
  })

  it('refuses to cancel an order that is already a real one', async () => {
    const db = createMockDb()

    await expect(
      cancelPending(db.pool, pending({ status: 'materialized', ordersId: 55 })),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(dbUpdate).not.toHaveBeenCalled()
  })
})
