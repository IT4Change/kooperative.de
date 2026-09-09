// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../../test/setup-server'
import { callHandler } from '../../../test/helpers/event'
import { createMockDb } from '../../../test/helpers/mock-db'
import { ORDER_STATUS_FLOW, buildStatusFlow } from '../../utils/orderStatus'

import orderDetail from './api/orders/[id].get'
import pendingDetail from './api/pending/[id].get'

const getPendingById = vi.hoisted(() => vi.fn())
vi.mock(import('../../utils/pendingOrder'), () => ({ getPendingById }))

/**
 * The two detail views of the admin. They assemble a whole screen out of several
 * queries, so the assertions focus on the assembly: that everything the operator
 * needs is present, correctly typed, and in the right order.
 */
function useMockDb(stubs: Parameters<typeof createMockDb>[0] = []) {
  const db = createMockDb(stubs)
  globalThis.useDB = (() => db.pool) as never
  return db
}

const ORDER_HEADER = {
  orders_id: 55,
  customers_id: 3,
  customers_name: 'Erika Musterfrau',
  customers_email_address: 'kundin@example.org',
  customers_telephone: '0711',
  customers_street_address: 'Im Winkel 11',
  customers_postcode: '88422',
  customers_city: 'Dürnau',
  customers_country: 'Deutschland',
  delivery_name: 'Erika Musterfrau',
  delivery_street_address: 'Im Winkel 11',
  delivery_postcode: '88422',
  delivery_city: 'Dürnau',
  delivery_country: 'Deutschland',
  payment_method: 'Bezahlung mit Vorkasse',
  orders_status: 3,
  orders_status_name: 'Versendet',
  date_purchased: '2026-01-01 10:00:00',
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, { ORDER_STATUS_FLOW, buildStatusFlow })
})

describe('GET /admin/api/orders/[id]', () => {
  function orderDb(over: Parameters<typeof createMockDb>[0] = []) {
    return useMockDb([
      ...over,
      { match: 'FROM orders o', rows: [ORDER_HEADER] },
      {
        match: 'FROM orders_products',
        rows: [
          {
            products_id: 1,
            products_model: 'HON-1',
            products_name: 'Honig',
            products_price: '10.0000',
            final_price: '11.9000',
            products_tax: '19.0000',
            products_quantity: 2,
          },
        ],
      },
      {
        match: 'FROM orders_total',
        rows: [
          {
            title: 'Zwischensumme:',
            text: '23,80',
            value: '23.80',
            class: 'ot_subtotal',
            sort_order: 1,
          },
          { title: 'Summe:', text: '23,80', value: '23.80', class: 'ot_total', sort_order: 4 },
        ],
      },
      {
        match: 'FROM orders_status_history',
        rows: [
          {
            orders_status_id: 1,
            date_added: '2026-01-01 10:00:00',
            customer_notified: 0,
            comments: '',
            orders_status_name: 'In Bearbeitung',
          },
        ],
      },
      {
        match: 'FROM orders_status',
        rows: [{ orders_status_id: 3, orders_status_name: 'Versendet' }],
      },
      { match: 'koop_order_mail_log', rows: [] },
      { match: 'koop_pending_order', rows: [] },
    ])
  }

  it('assembles header, address, items, totals and history', async () => {
    orderDb()

    const result = await callHandler<Record<string, never>>(orderDetail, { params: { id: '55' } })

    expect(result.order).toMatchObject({ id: 55, statusName: 'Versendet' })
    expect(result.products).toHaveLength(1)
    expect(result.totals).toHaveLength(2)
    expect(result.history).toHaveLength(1)
  })

  it('converts the DECIMAL columns into numbers', async () => {
    orderDb()

    const result = await callHandler<{ products: Record<string, number>[] }>(orderDetail, {
      params: { id: '55' },
    })

    // mysql2 hands DECIMALs over as strings; the admin renders arithmetic on them.
    expect(result.products[0]).toMatchObject({ price: 10, finalPrice: 11.9, tax: 19, quantity: 2 })
  })

  it('carries both the invoice and the delivery address', async () => {
    orderDb()

    const result = await callHandler<{ order: { customer: unknown; delivery: unknown } }>(
      orderDetail,
      { params: { id: '55' } },
    )

    expect(result.order.customer).toMatchObject({ street: 'Im Winkel 11', city: 'Dürnau' })
    expect(result.order.delivery).toMatchObject({ street: 'Im Winkel 11', city: 'Dürnau' })
  })

  it.each([['abc'], ['0'], ['-1']])('rejects the invalid id %j', async (id) => {
    orderDb()

    await expect(callHandler(orderDetail, { params: { id } })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('answers 404 for an order that does not exist', async () => {
    useMockDb([{ match: 'FROM orders o', rows: [] }])

    await expect(callHandler(orderDetail, { params: { id: '999' } })).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('GET /admin/api/pending/[id]', () => {
  const PENDING = {
    id: 12,
    status: 'pending',
    ordersId: null,
    confirmedVia: null,
    createdAt: '2026-01-01 10:00:00',
    confirmedAt: null,
    total: 23.8,
    payload: {
      comp: {
        customer: { name: 'Erika Musterfrau', email: 'kundin@example.org' },
        lines: [{ name: 'Honig', quantity: 2, unitGross: 11.9, lineGross: 23.8 }],
        subtotalGross: 23.8,
        shipping: { module: 'Abholung', gross: 0 },
        taxRows: [],
        payment: { label: 'Bezahlung mit Vorkasse' },
        total: 23.8,
      },
    },
  }

  function pendingDb() {
    return useMockDb([
      { match: 'koop_order_mail_log', rows: [] },
      {
        match: 'FROM orders_status',
        rows: [
          { orders_status_id: 1, orders_status_name: 'In Bearbeitung' },
          { orders_status_id: 3, orders_status_name: 'Versendet' },
        ],
      },
    ])
  }

  it('puts the confirmation step in front of the osCommerce flow', async () => {
    pendingDb()
    getPendingById.mockResolvedValue(PENDING)

    const result = await callHandler<{ statusFlow: { id: number; state: string }[] }>(
      pendingDetail,
      { params: { id: '12' } },
    )

    // A pending order sits before status 1, so the stepper needs an extra step
    // that osCommerce does not know about.
    expect(result.statusFlow[0]).toMatchObject({
      id: -1,
      name: 'Bestätigung ausstehend',
      state: 'current',
    })
    expect(result.statusFlow.slice(1).every((s) => s.state === 'upcoming')).toBe(true)
  })

  it('marks the confirmation as done once the order was materialised', async () => {
    pendingDb()
    getPendingById.mockResolvedValue({ ...PENDING, status: 'materialized', ordersId: 55 })

    const result = await callHandler<{ statusFlow: { state: string }[] }>(pendingDetail, {
      params: { id: '12' },
    })

    expect(result.statusFlow[0].state).toBe('done')
  })

  it('names a status the shop does not label', async () => {
    useMockDb([
      { match: 'koop_order_mail_log', rows: [] },
      { match: 'FROM orders_status', rows: [] },
    ])
    getPendingById.mockResolvedValue(PENDING)

    const result = await callHandler<{ statusFlow: { name: string }[] }>(pendingDetail, {
      params: { id: '12' },
    })

    expect(result.statusFlow[1].name).toMatch(/^Status \d+$/)
  })

  it('returns the pinned order content', async () => {
    pendingDb()
    getPendingById.mockResolvedValue(PENDING)

    const result = await callHandler<Record<string, never>>(pendingDetail, { params: { id: '12' } })

    expect(result.pending).toMatchObject({ id: 12, status: 'pending', total: 23.8 })
  })

  it('rejects an invalid id', async () => {
    pendingDb()

    await expect(callHandler(pendingDetail, { params: { id: 'abc' } })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it.each([
    ['an unknown id', null],
    ['a record whose payload is unreadable', { payload: { comp: null } }],
  ])('answers 404 for %s', async (_label, value) => {
    pendingDb()
    getPendingById.mockResolvedValue(value)

    await expect(callHandler(pendingDetail, { params: { id: '12' } })).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
