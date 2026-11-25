// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMockDb } from '../../test/helpers/mock-db'

import { listWithdrawals, recordWithdrawal, withdrawalsForOrder } from './withdrawal'

const dbInsert = vi.hoisted(() => vi.fn())
vi.mock(import('./dbWrite'), () => ({ dbInsert }))

/**
 * A declaration is stored as made, and linked to an order only when number
 * and address belong together — a number alone must not attach someone's
 * declaration to a stranger's order.
 */
const INPUT = {
  name: 'Erika Musterfrau',
  email: 'kundin@example.org',
  orderRef: '55',
  scope: 'all' as const,
}
const NOW = new Date('2026-11-17T13:03:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  dbInsert.mockResolvedValue(3)
})

describe('recordWithdrawal', () => {
  it('links the order when number and address match', async () => {
    const db = createMockDb([{ match: 'FROM orders', rows: [{ orders_id: 55, customers_id: 9 }] }])

    const w = await recordWithdrawal(db.pool, INPUT, NOW)

    expect(db.calls[0].params).toStrictEqual([55, 'kundin@example.org'])
    expect(db.sql(0)).toContain('LOWER(customers_email_address) = ?')
    expect(w).toStrictEqual({
      id: 3,
      ...INPUT,
      items: null,
      message: null,
      ordersId: 55,
      customersId: 9,
      createdAt: '2026-11-17T13:03:00.000Z',
    })
    expect(dbInsert).toHaveBeenCalledWith(
      db.pool,
      'koop_withdrawal',
      expect.objectContaining({ order_ref: '55', orders_id: 55, customers_id: 9, created_at: NOW }),
      // Deliberately no remoteIp: it would add personal data and prove nothing.
      { orderId: 55, customerId: 9 },
    )
  })

  it('stores the declaration unlinked when nothing matches', async () => {
    const db = createMockDb([{ match: 'FROM orders', rows: [] }])

    const w = await recordWithdrawal(
      db.pool,
      { ...INPUT, scope: 'partial', items: '1× Honig', message: 'kaputt' },
      NOW,
    )

    expect(w).toMatchObject({
      ordersId: null,
      customersId: null,
      items: '1× Honig',
      message: 'kaputt',
    })
    expect(dbInsert.mock.calls[0][3]).toStrictEqual({ orderId: undefined, customerId: undefined })
  })

  it('does not look for an order when the reference is not a number', async () => {
    const db = createMockDb()

    const w = await recordWithdrawal(db.pool, { ...INPUT, orderRef: 'vom 3. November' })

    expect(db.calls).toHaveLength(0)
    expect(w.ordersId).toBeNull()
  })
})

const ROW = {
  id: 3,
  name: 'Erika Musterfrau',
  email: 'kundin@example.org',
  order_ref: '55',
  scope: 'partial',
  items: '1× Honig',
  message: null,
  orders_id: 55,
  customers_id: null,
  created_at: '2026-11-17T13:03:00.000Z',
}

describe('listWithdrawals', () => {
  it('pages newest first and counts everything', async () => {
    const db = createMockDb([
      { match: 'COUNT(*)', rows: [{ n: 51 }] },
      {
        match: 'SELECT * FROM koop_withdrawal',
        rows: [
          ROW,
          {
            ...ROW,
            id: 2,
            scope: 'all',
            items: null,
            message: 'x',
            orders_id: null,
            customers_id: 4,
          },
        ],
      },
    ])

    const result = await listWithdrawals(db.pool, 2, 50)

    expect(result.total).toBe(51)
    expect(db.sql(1)).toContain('ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET 50')
    expect(result.withdrawals[0]).toStrictEqual({
      id: 3,
      name: 'Erika Musterfrau',
      email: 'kundin@example.org',
      orderRef: '55',
      scope: 'partial',
      items: '1× Honig',
      message: null,
      ordersId: 55,
      customersId: null,
      createdAt: '2026-11-17T13:03:00.000Z',
    })
    expect(result.withdrawals[1]).toMatchObject({
      scope: 'all',
      ordersId: null,
      customersId: 4,
      message: 'x',
    })
  })

  it('counts zero for an empty table', async () => {
    const db = createMockDb([{ match: 'COUNT(*)', rows: [] }])

    await expect(listWithdrawals(db.pool, 1, 50)).resolves.toStrictEqual({
      total: 0,
      withdrawals: [],
    })
  })
})

describe('withdrawalsForOrder', () => {
  it('reads the declarations of one order, oldest first', async () => {
    const db = createMockDb([{ match: 'WHERE orders_id = ?', rows: [ROW] }])

    const found = await withdrawalsForOrder(db.pool, 55)

    expect(found).toHaveLength(1)
    expect(db.calls[0].params).toStrictEqual([55])
    expect(db.sql(0)).toContain('ORDER BY created_at, id')
  })
})
