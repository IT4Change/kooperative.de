// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../../test/setup-server'
import { callHandler } from '../../../test/helpers/event'
import { createMockDb } from '../../../test/helpers/mock-db'
import { getAdminUser } from '../../utils/adminAuth'
import { buildStatusMail } from '../../utils/statusMail'

import customerList from './api/customers/index.get'
import dashboard from './api/dashboard.get'
import notify from './api/orders/[id]/notify.post'
import statusPost from './api/orders/[id]/status.post'
import orderList from './api/orders/index.get'
import cancelPendingEndpoint from './api/pending/[id]/cancel.post'
import confirmPendingEndpoint from './api/pending/[id]/confirm.post'
import productList from './api/products/index.get'

/**
 * These handlers take their dependencies from Nitro's auto-imports rather than
 * from explicit imports, so they read globals — mocking the modules would have
 * no effect. The write and mail functions are installed as spies; getAdminUser
 * and buildStatusMail stay real, because they are pure and their output is part
 * of what is asserted.
 */
const dbInsert = vi.fn()
const dbUpdate = vi.fn()
const sendAndLogOrderMail = vi.fn()

const getPendingById = vi.hoisted(() => vi.fn())
vi.mock(import('../../utils/pendingOrder'), () => ({
  getPendingById,
  cancelPending: vi.fn(),
  getPendingByOrderId: vi.fn(),
}))

const confirmPending = vi.hoisted(() => vi.fn())
vi.mock(import('../../utils/pendingConfirm'), () => ({ confirmPending }))

/**
 * The /admin data endpoints. They read and write the same osCommerce tables the
 * legacy backend used, so the generated SQL is part of what is checked — a
 * changed WHERE clause is a changed result set for the operator.
 */
function useMockDb(stubs: Parameters<typeof createMockDb>[0] = []) {
  const db = createMockDb(stubs)
  globalThis.useDB = (() => db.pool) as never
  return db
}

const ADMIN_HEADER = {
  authorization: `Basic ${Buffer.from('anna:geheim').toString('base64')}`,
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, {
    dbInsert,
    dbUpdate,
    sendAndLogOrderMail,
    getAdminUser,
    buildStatusMail,
  })
  dbInsert.mockResolvedValue(1)
  dbUpdate.mockResolvedValue(1)
  sendAndLogOrderMail.mockResolvedValue({ status: 'sent', errorMessage: null })
  confirmPending.mockResolvedValue({ ordersId: 55, alreadyDone: false })
})

describe('GET /admin/api/dashboard', () => {
  it('reports the order counts per status and the statistics', async () => {
    useMockDb([
      {
        match: 'FROM orders_status os',
        rows: [
          { id: 1, name: 'In Bearbeitung', count: 4 },
          { id: 3, name: 'Versendet', count: 9 },
        ],
      },
      { match: 'SELECT (SELECT COUNT', rows: [{ customers: 12, productsActive: 36, reviews: 2 }] },
      { match: 'koop_pending_order', rows: [{ c: 3 }] },
    ])

    await expect(callHandler(dashboard)).resolves.toStrictEqual({
      statuses: [
        { id: 1, name: 'In Bearbeitung', count: 4 },
        { id: 3, name: 'Versendet', count: 9 },
      ],
      pendingCount: 3,
      stats: { customers: 12, productsActive: 36, reviews: 2 },
    })
  })

  it('degrades gracefully when the koop table is not migrated yet', async () => {
    useMockDb([
      { match: 'FROM orders_status os', rows: [] },
      { match: 'SELECT (SELECT COUNT', rows: [{ customers: 1, productsActive: 1, reviews: 0 }] },
      { match: 'koop_pending_order', error: new Error("Table 'koop_pending_order' doesn't exist") },
    ])

    // The old shop's dashboard must keep working on a database without the
    // new tables, otherwise a half-finished deploy takes the admin down.
    const result = await callHandler<{ pendingCount: number }>(dashboard)
    expect(result.pendingCount).toBe(0)
  })

  it('falls back to zeroes when the statistics query returns nothing', async () => {
    useMockDb([{ match: 'FROM orders_status os', rows: [] }])

    await expect(callHandler<{ stats: Record<string, number> }>(dashboard)).resolves.toMatchObject({
      stats: { customers: 0, productsActive: 0, reviews: 0 },
    })
  })
})

describe('GET /admin/api/customers', () => {
  const ROW = {
    customers_id: 3,
    customers_firstname: 'Erika',
    customers_lastname: 'Musterfrau',
    customers_email_address: 'kundin@example.org',
    customers_telephone: '0711',
    entry_postcode: '88422',
    entry_city: 'Dürnau',
  }

  it('lists customers with a combined name and place', async () => {
    useMockDb([
      { match: 'COUNT(*) AS total', rows: [{ total: 1 }] },
      { match: 'FROM customers c', rows: [ROW] },
    ])

    const result = await callHandler<{ total: number; customers: Record<string, unknown>[] }>(
      customerList,
    )

    expect(result.total).toBe(1)
    expect(result.customers[0]).toStrictEqual({
      id: 3,
      name: 'Erika Musterfrau',
      email: 'kundin@example.org',
      telephone: '0711',
      city: '88422 Dürnau',
    })
  })

  it('searches name and address for a text query', async () => {
    const db = useMockDb([{ match: 'COUNT(*) AS total', rows: [{ total: 0 }] }])

    await callHandler(customerList, { url: '/admin/api/customers?q=muster' })

    expect(db.sql(0)).toContain('customers_email_address LIKE ?')
    expect(db.calls[0].params).toStrictEqual(['%muster%', '%muster%'])
  })

  it('also matches the customer id for a numeric query', async () => {
    const db = useMockDb([{ match: 'COUNT(*) AS total', rows: [{ total: 0 }] }])

    await callHandler(customerList, { url: '/admin/api/customers?q=42' })

    expect(db.sql(0)).toContain('c.customers_id = ?')
    expect(db.calls[0].params[0]).toBe(42)
  })

  it('paginates and caps the page size', async () => {
    const db = useMockDb([{ match: 'COUNT(*) AS total', rows: [{ total: 0 }] }])

    await callHandler(customerList, { url: '/admin/api/customers?page=3&limit=9999' })

    // An uncapped limit would let one request pull the whole customer table.
    expect(db.sql(1)).toContain('LIMIT 200 OFFSET 400')
  })

  it('falls back to the first page for nonsense input', async () => {
    const db = useMockDb([{ match: 'COUNT(*) AS total', rows: [{ total: 0 }] }])

    await callHandler(customerList, { url: '/admin/api/customers?page=-5&limit=abc' })

    expect(db.sql(1)).toContain('LIMIT 50 OFFSET 0')
  })
})

describe('GET /admin/api/products', () => {
  it('filters to active products on request', async () => {
    const db = useMockDb([{ match: 'COUNT(*)', rows: [{ total: 0 }] }])

    await callHandler(productList, { url: '/admin/api/products?active=1' })

    expect(db.sql(0)).toContain('p.products_status = 1')
  })

  it('searches name and model', async () => {
    const db = useMockDb([{ match: 'COUNT(*)', rows: [{ total: 0 }] }])

    await callHandler(productList, { url: '/admin/api/products?q=honig' })

    expect(db.sql(0)).toContain('pd.products_name LIKE ?')
    expect(db.calls[0].params).toStrictEqual(['%honig%', '%honig%'])
  })

  it('also matches the product id for a numeric query', async () => {
    const db = useMockDb([{ match: 'COUNT(*)', rows: [{ total: 0 }] }])

    await callHandler(productList, { url: '/admin/api/products?q=747' })

    expect(db.calls[0].params[0]).toBe(747)
  })

  it('converts the DECIMAL price into a number', async () => {
    useMockDb([
      { match: 'COUNT(*)', rows: [{ total: 1 }] },
      {
        match: 'FROM products p',
        rows: [
          {
            products_id: 1,
            products_model: 'HON-1',
            products_status: 1,
            products_price: '10.0000',
            products_name: 'Honig',
          },
        ],
      },
    ])

    const result = await callHandler<{ products: { price: number }[] }>(productList)

    expect(result.products[0].price).toBe(10)
  })
})

describe('GET /admin/api/orders', () => {
  it('defaults to the active statuses and hides completed orders', async () => {
    const db = useMockDb([
      { match: 'FROM koop_pending_order kp LIMIT', rows: [{ 1: 1 }] },
      { match: 'COUNT(*) AS c', rows: [{ c: 0 }] },
    ])

    await callHandler(orderList)

    // Status 3 (Versendet) is deliberately absent from the default view.
    const union = db.calls.find((c) => c.sql.includes('UNION ALL'))
    expect(union?.sql ?? db.sql(1)).toBeDefined()
    expect(db.calls.some((c) => c.params.includes(3))).toBe(false)
  })

  it('returns an empty result for status=none without querying', async () => {
    useMockDb([{ match: 'FROM koop_pending_order kp LIMIT', rows: [{ 1: 1 }] }])

    const result = await callHandler(orderList, { url: '/admin/api/orders?status=none' })

    // An empty UNION would be invalid SQL — the handler short-circuits instead.
    expect(result).toStrictEqual({ total: 0, page: 1, limit: 50, orders: [] })
  })

  it('parses the customer name of a pending order out of its payload', async () => {
    useMockDb([
      { match: 'FROM koop_pending_order kp LIMIT', rows: [{ 1: 1 }] },
      { match: 'COUNT(*) AS c', rows: [{ c: 1 }] },
      {
        match: 'UNION ALL',
        rows: [
          {
            kind: 'pending',
            id: 12,
            date: '2026-01-01',
            customer_name: null,
            email: 'kundin@example.org',
            status_id: 0,
            status_name: 'Bestätigung ausstehend',
            payment: null,
            total: '23.80',
            origin: 'neu',
            payload: JSON.stringify({
              comp: {
                customer: { name: 'Erika Musterfrau' },
                payment: { label: 'Bezahlung mit Vorkasse' },
              },
            }),
          },
        ],
      },
    ])

    const result = await callHandler<{ orders: Record<string, unknown>[] }>(orderList, {
      url: '/admin/api/orders?status=all',
    })

    // No JSON functions in SQL — this has to work on older MySQL too.
    expect(result.orders[0]).toMatchObject({
      kind: 'pending',
      customerName: 'Erika Musterfrau',
      paymentMethod: 'Bezahlung mit Vorkasse',
      origin: 'neu',
    })
  })

  it('leaves the name blank when the payload is unreadable', async () => {
    useMockDb([
      { match: 'FROM koop_pending_order kp LIMIT', rows: [{ 1: 1 }] },
      { match: 'COUNT(*) AS c', rows: [{ c: 1 }] },
      {
        match: 'UNION ALL',
        rows: [
          {
            kind: 'pending',
            id: 12,
            email: 'x@example.org',
            status_id: 0,
            total: null,
            origin: 'neu',
            payload: '{broken',
          },
        ],
      },
    ])

    const result = await callHandler<{ orders: { customerName: string; total: null }[] }>(
      orderList,
      { url: '/admin/api/orders?status=all' },
    )

    expect(result.orders[0].customerName).toBe('')
    expect(result.orders[0].total).toBeNull()
  })

  it('degrades to an osCommerce-only list when the koop table is missing', async () => {
    const db = useMockDb([
      { match: 'FROM koop_pending_order kp LIMIT', error: new Error('no such table') },
      { match: 'COUNT(*) AS c', rows: [{ c: 0 }] },
    ])

    await callHandler(orderList, { url: '/admin/api/orders?status=all' })

    // Without the table there is nothing to join against, so origin is constant.
    const union = db.calls.map((c) => c.sql).join(' ')
    expect(union).toContain("'alt'")
  })

  it('searches by order number for a numeric query', async () => {
    const db = useMockDb([
      { match: 'FROM koop_pending_order kp LIMIT', rows: [{ 1: 1 }] },
      { match: 'COUNT(*) AS c', rows: [{ c: 0 }] },
    ])

    await callHandler(orderList, { url: '/admin/api/orders?status=all&q=55' })

    expect(db.calls.some((c) => c.sql.includes('o.orders_id = ?'))).toBe(true)
    expect(db.calls.some((c) => c.params.includes(55))).toBe(true)
  })
})

describe('POST /admin/api/orders/[id]/status', () => {
  function statusDb() {
    return useMockDb([
      { match: 'FROM orders_status WHERE', rows: [{ orders_status_name: 'Versendet' }] },
      {
        match: 'FROM orders WHERE',
        rows: [
          {
            orders_id: 55,
            customers_name: 'Erika Musterfrau',
            customers_email_address: 'kundin@example.org',
          },
        ],
      },
    ])
  }

  it('updates the order and writes a history entry', async () => {
    statusDb()

    const result = await callHandler(statusPost, {
      method: 'POST',
      params: { id: '55' },
      headers: ADMIN_HEADER,
      body: { statusId: 3, comment: 'Paket raus' },
    })

    expect(result).toMatchObject({
      ok: true,
      statusId: 3,
      statusName: 'Versendet',
      notified: false,
    })
    expect(dbUpdate).toHaveBeenCalledWith(
      expect.anything(),
      'orders',
      { orders_id: 55 },
      expect.objectContaining({ orders_status: 3 }),
      expect.anything(),
    )
    expect(dbInsert).toHaveBeenCalledWith(
      expect.anything(),
      'orders_status_history',
      expect.objectContaining({
        orders_status_id: 3,
        customer_notified: 0,
        comments: 'Paket raus',
      }),
      expect.anything(),
    )
  })

  it('mails the customer and records the notification when asked', async () => {
    statusDb()

    const result = await callHandler<{ notified: boolean }>(statusPost, {
      method: 'POST',
      params: { id: '55' },
      headers: ADMIN_HEADER,
      body: { statusId: 3, notifyCustomer: true },
    })

    expect(result.notified).toBe(true)
    expect(sendAndLogOrderMail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mailType: 'status_notification',
        recipient: 'kundin@example.org',
        sentBy: 'anna',
      }),
      expect.anything(),
    )
    expect(dbInsert.mock.calls[0][2]).toMatchObject({ customer_notified: 1 })
  })

  it('accepts the notify flag as a string, as the form sends it', async () => {
    statusDb()

    const result = await callHandler<{ notified: boolean }>(statusPost, {
      method: 'POST',
      params: { id: '55' },
      headers: ADMIN_HEADER,
      body: { statusId: 3, notifyCustomer: 'true' },
    })

    expect(result.notified).toBe(true)
  })

  it.each([
    ['a non-numeric order id', { id: 'abc' }, { statusId: 3 }, 400],
    ['a missing status', { id: '55' }, {}, 400],
    ['a zero status', { id: '55' }, { statusId: 0 }, 400],
  ])('rejects %s', async (_label, params, body, status) => {
    statusDb()

    await expect(
      callHandler(statusPost, { method: 'POST', params, headers: ADMIN_HEADER, body }),
    ).rejects.toMatchObject({ statusCode: status })
  })

  it('rejects a status the shop does not know', async () => {
    useMockDb([{ match: 'FROM orders_status WHERE', rows: [] }])

    await expect(
      callHandler(statusPost, {
        method: 'POST',
        params: { id: '55' },
        headers: ADMIN_HEADER,
        body: { statusId: 99 },
      }),
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Unbekannter Status' })
  })

  it('answers 404 for an order that does not exist', async () => {
    useMockDb([
      { match: 'FROM orders_status WHERE', rows: [{ orders_status_name: 'Versendet' }] },
      { match: 'FROM orders WHERE', rows: [] },
    ])

    await expect(
      callHandler(statusPost, {
        method: 'POST',
        params: { id: '999' },
        headers: ADMIN_HEADER,
        body: { statusId: 3 },
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('POST /admin/api/orders/[id]/notify', () => {
  function notifyDb(over: Record<string, unknown> = {}) {
    return useMockDb([
      {
        match: 'FROM orders o',
        rows: [
          {
            orders_id: 55,
            orders_status: 3,
            customers_name: 'Erika Musterfrau',
            customers_email_address: 'kundin@example.org',
            orders_status_name: 'Versendet',
            ...over,
          },
        ],
      },
    ])
  }

  it('resends the current status without changing anything', async () => {
    notifyDb()

    const result = await callHandler<{ ok: boolean }>(notify, {
      method: 'POST',
      params: { id: '55' },
      headers: ADMIN_HEADER,
      body: { comment: 'Zweiter Versuch' },
    })

    expect(result.ok).toBe(true)
    expect(dbUpdate).not.toHaveBeenCalled()
    expect(sendAndLogOrderMail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mailType: 'status_notification_resend', relatedStatusId: 3 }),
      expect.anything(),
    )
  })

  it('works without a body', async () => {
    notifyDb()

    const result = await callHandler<{ ok: boolean }>(notify, {
      method: 'POST',
      params: { id: '55' },
      headers: ADMIN_HEADER,
    })

    expect(result.ok).toBe(true)
  })

  it('falls back to a generic label for a status without a name', async () => {
    notifyDb({ orders_status_name: null })

    await callHandler(notify, { method: 'POST', params: { id: '55' }, headers: ADMIN_HEADER })

    expect(sendAndLogOrderMail.mock.calls[0][1].subject).toContain('Status 3')
  })

  it('refuses when the order has no mail address', async () => {
    notifyDb({ customers_email_address: '' })

    await expect(
      callHandler(notify, { method: 'POST', params: { id: '55' }, headers: ADMIN_HEADER }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('reports a failed send as not ok', async () => {
    notifyDb()
    sendAndLogOrderMail.mockResolvedValue({ status: 'failed', errorMessage: 'smtp down' })

    const result = await callHandler<{ ok: boolean }>(notify, {
      method: 'POST',
      params: { id: '55' },
      headers: ADMIN_HEADER,
    })

    expect(result.ok).toBe(false)
  })

  it('answers 404 for an unknown order', async () => {
    useMockDb([{ match: 'FROM orders o', rows: [] }])

    await expect(
      callHandler(notify, { method: 'POST', params: { id: '999' }, headers: ADMIN_HEADER }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('pending actions', () => {
  it('confirms a pending order on the operator‘s behalf', async () => {
    useMockDb()
    getPendingById.mockResolvedValue({ id: 12 })

    const result = await callHandler(confirmPendingEndpoint, {
      method: 'POST',
      params: { id: '12' },
    })

    expect(result).toStrictEqual({ ok: true, orderId: 55, alreadyConfirmed: false })
    // 'admin' rather than 'link': the mail history has to show who confirmed.
    expect(confirmPending).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { id: 12 },
      'admin',
      expect.anything(),
    )
  })

  it('cancels a pending order', async () => {
    useMockDb()
    getPendingById.mockResolvedValue({ id: 12 })

    await expect(
      callHandler(cancelPendingEndpoint, { method: 'POST', params: { id: '12' } }),
    ).resolves.toStrictEqual({ ok: true })
  })

  it.each([
    ['confirm', confirmPendingEndpoint],
    ['cancel', cancelPendingEndpoint],
  ])('%s rejects a non-numeric id', async (_label, handler) => {
    useMockDb()

    await expect(
      callHandler(handler, { method: 'POST', params: { id: 'abc' } }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it.each([
    ['confirm', confirmPendingEndpoint],
    ['cancel', cancelPendingEndpoint],
  ])('%s answers 404 for an unknown pending order', async (_label, handler) => {
    useMockDb()
    getPendingById.mockResolvedValue(null)

    await expect(
      callHandler(handler, { method: 'POST', params: { id: '999' } }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
