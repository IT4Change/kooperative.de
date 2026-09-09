// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../../test/setup-server'
import { callHandler } from '../../../test/helpers/event'
import { createMockDb } from '../../../test/helpers/mock-db'
import { ORDER_STATUS_FLOW, buildStatusFlow } from '../../utils/orderStatus'

import orderDetail from './api/orders/[id].get'
import pendingDetail from './api/pending/[id].get'

const getPendingById = vi.hoisted(() => vi.fn())
const getPendingByOrderId = vi.hoisted(() => vi.fn())
vi.mock(import('../../utils/pendingOrder'), () => ({ getPendingById, getPendingByOrderId }))

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
  getPendingByOrderId.mockResolvedValue(null)
  // The order detail handler reaches for getPendingByOrderId through Nitro's
  // auto-import rather than an import statement, so vi.mock() alone does not
  // reach it — without the global it hits a ReferenceError that the handler's
  // own try/catch then swallows.
  Object.assign(globalThis, { ORDER_STATUS_FLOW, buildStatusFlow, getPendingByOrderId })
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
            comments: 'Zahlung geprüft',
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

  it('carries the optional columns through when the order has them', async () => {
    useMockDb([
      {
        match: 'FROM orders o',
        rows: [
          {
            ...ORDER_HEADER,
            currency: 'CHF',
            customers_company: 'Muster GmbH',
            customers_suburb: 'Hinterhaus',
            delivery_company: 'Muster GmbH',
            delivery_suburb: 'Hinterhaus',
          },
        ],
      },
      { match: 'FROM orders_products', rows: [] },
      { match: 'FROM orders_total', rows: [] },
      { match: 'FROM orders_status_history', rows: [] },
      { match: 'FROM orders_status', rows: [] },
      { match: 'koop_order_mail_log', rows: [] },
    ])

    const result = await callHandler<{
      order: {
        currency: string
        customer: Record<string, string>
        delivery: Record<string, string>
      }
    }>(orderDetail, { params: { id: '55' } })

    expect(result.order.currency).toBe('CHF')
    expect(result.order.customer).toMatchObject({
      company: 'Muster GmbH',
      suburb: 'Hinterhaus',
    })
    expect(result.order.delivery).toMatchObject({
      company: 'Muster GmbH',
      suburb: 'Hinterhaus',
    })
  })

  it('turns the NULLs of a legacy row into empty strings, never into "null"', async () => {
    // Two decades of osCommerce left plenty of empty columns behind. Rendering
    // them would put the string "null" in front of the operator.
    useMockDb([
      {
        match: 'FROM orders o',
        rows: [
          {
            orders_id: 55,
            customers_id: 3,
            orders_status: 3,
            orders_status_name: null,
            date_purchased: '2026-01-01 10:00:00',
            payment_method: null,
            currency: null,
            customers_name: null,
            customers_company: null,
            customers_email_address: null,
            customers_telephone: null,
            customers_street_address: null,
            customers_suburb: null,
            customers_postcode: null,
            customers_city: null,
            customers_country: null,
            delivery_name: null,
            delivery_company: null,
            delivery_street_address: null,
            delivery_suburb: null,
            delivery_postcode: null,
            delivery_city: null,
            delivery_country: null,
          },
        ],
      },
      {
        match: 'FROM orders_products',
        rows: [
          {
            products_id: 1,
            products_model: null,
            products_name: null,
            products_price: '0.0000',
            final_price: '0.0000',
            products_tax: '0.0000',
            products_quantity: 1,
          },
        ],
      },
      {
        match: 'FROM orders_total',
        rows: [{ title: null, text: null, value: null, class: null, sort_order: 1 }],
      },
      {
        match: 'FROM orders_status_history',
        rows: [
          {
            orders_status_id: 1,
            date_added: '2026-01-01 10:00:00',
            customer_notified: null,
            comments: null,
            orders_status_name: null,
          },
        ],
      },
      { match: 'FROM orders_status', rows: [] },
      { match: 'koop_order_mail_log', rows: [] },
    ])

    const result = await callHandler<{
      order: {
        statusName: null
        paymentMethod: string
        currency: string
        customer: Record<string, unknown>
        delivery: Record<string, unknown>
      }
      products: Record<string, unknown>[]
      totals: Record<string, unknown>[]
      history: Record<string, unknown>[]
    }>(orderDetail, { params: { id: '55' } })

    expect(result.order.statusName).toBeNull()
    expect(result.order.paymentMethod).toBe('')
    // The currency is the one field with a sensible default rather than a blank.
    expect(result.order.currency).toBe('EUR')
    expect(result.order.customer).toMatchObject({
      name: '',
      company: null,
      email: '',
      telephone: '',
      street: '',
      suburb: null,
      postcode: '',
      city: '',
      country: '',
    })
    expect(result.order.delivery).toMatchObject({
      name: '',
      company: null,
      street: '',
      suburb: null,
      postcode: '',
      city: '',
      country: '',
    })
    expect(result.products[0]).toMatchObject({ model: '', name: '' })
    expect(result.totals[0]).toMatchObject({ title: '', text: '', value: null, class: '' })
    expect(result.history[0]).toMatchObject({
      statusName: null,
      comments: '',
      customerNotified: false,
    })
  })

  it('prepends the confirmation step for an order that came from the new shop', async () => {
    orderDb()
    getPendingByOrderId.mockResolvedValue({
      confirmedVia: 'reply',
      confirmedAt: '2026-01-02 09:00:00',
    })

    const result = await callHandler<{
      origin: string
      confirmation: { via: string; at: string }
      statusFlow: { id: number; name: string; state: string }[]
    }>(orderDetail, { params: { id: '55' } })

    expect(result.origin).toBe('neu')
    expect(result.confirmation).toStrictEqual({ via: 'reply', at: '2026-01-02 09:00:00' })
    expect(result.statusFlow[0]).toMatchObject({
      id: -1,
      name: 'Bestätigung ausstehend',
      state: 'done',
    })
  })

  it('treats the order as an old-shop one when the pending table is absent', async () => {
    // koop_pending_order does not exist on every environment.
    orderDb()
    getPendingByOrderId.mockRejectedValue(new Error("Table 'koop_pending_order' doesn't exist"))

    const result = await callHandler<{ origin: string; confirmation: null }>(orderDetail, {
      params: { id: '55' },
    })

    expect(result.origin).toBe('alt')
    expect(result.confirmation).toBeNull()
  })

  it('lists the mails that went out for the order', async () => {
    orderDb([
      {
        match: 'koop_order_mail_log',
        rows: [
          {
            id: 7,
            direction: 'to_customer',
            recipient: 'kundin@example.org',
            mail_type: 'status_notification',
            related_status_id: 3,
            subject: 'Ihre Bestellung',
            status: 'sent',
            sent_by: 'admin',
            created_at: '2026-01-02 09:00:00',
          },
          {
            id: 8,
            direction: 'to_admin',
            recipient: null,
            mail_type: null,
            related_status_id: null,
            subject: null,
            status: 'failed',
            sent_by: null,
            created_at: '2026-01-02 09:01:00',
          },
        ],
      },
    ])

    const result = await callHandler<{ mails: Record<string, unknown>[] }>(orderDetail, {
      params: { id: '55' },
    })

    expect(result.mails[0]).toMatchObject({
      id: 7,
      recipient: 'kundin@example.org',
      mailType: 'status_notification',
      relatedStatusId: 3,
      sentBy: 'admin',
    })
    expect(result.mails[1]).toMatchObject({
      recipient: '',
      mailType: '',
      relatedStatusId: null,
      subject: '',
      sentBy: null,
    })
  })

  it('still renders the order when the mail log table is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    orderDb([
      {
        match: 'koop_order_mail_log',
        error: new Error("Table 'koop_order_mail_log' doesn't exist"),
      },
    ])

    const result = await callHandler<{ mails: unknown[]; order: unknown }>(orderDetail, {
      params: { id: '55' },
    })

    // The mail timeline is an addition; losing it must not cost the operator the order.
    expect(result.mails).toStrictEqual([])
    expect(result.order).toBeDefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('links into the old admin when a base URL is configured', async () => {
    orderDb()
    process.env.ADMIN_BASE_URL = 'https://shop.example.org/admin/'

    const result = await callHandler<{ oldAdminUrl: string }>(orderDetail, { params: { id: '55' } })

    // The trailing slash of the configured value must not survive into the URL.
    expect(result.oldAdminUrl).toBe('https://shop.example.org/admin/orders.php?oID=55&action=edit')
    delete process.env.ADMIN_BASE_URL
  })

  it('leaves the link out when no old admin is configured', async () => {
    orderDb()

    const result = await callHandler<{ oldAdminUrl: null }>(orderDetail, { params: { id: '55' } })

    expect(result.oldAdminUrl).toBeNull()
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

  it('reports tax rows and the mail history of the pending order', async () => {
    useMockDb([
      {
        match: 'koop_order_mail_log',
        rows: [
          {
            id: 3,
            direction: 'to_customer',
            recipient: 'kundin@example.org',
            mail_type: 'order_confirmation_request',
            subject: 'Bitte bestätigen',
            status: 'sent',
            sent_by: 'system',
            created_at: '2026-01-01 10:01:00',
          },
          {
            id: 4,
            direction: 'to_admin',
            recipient: null,
            mail_type: null,
            subject: null,
            status: 'failed',
            sent_by: null,
            created_at: '2026-01-01 10:02:00',
          },
        ],
      },
      { match: 'FROM orders_status', rows: [] },
    ])
    getPendingById.mockResolvedValue({
      ...PENDING,
      payload: {
        comp: {
          ...PENDING.payload.comp,
          // Rounded on the way out: the pinned value carries full precision.
          taxRows: [{ description: 'zzgl. 7% MwSt.', total: 1.7133 }],
        },
      },
    })

    const result = await callHandler<{
      taxRows: { description: string; total: number }[]
      mails: Record<string, unknown>[]
    }>(pendingDetail, { params: { id: '12' } })

    expect(result.taxRows).toStrictEqual([{ description: 'zzgl. 7% MwSt.', total: 1.71 }])
    expect(result.mails[0]).toMatchObject({
      id: 3,
      recipient: 'kundin@example.org',
      mailType: 'order_confirmation_request',
      sentBy: 'system',
    })
    expect(result.mails[1]).toMatchObject({
      recipient: '',
      mailType: '',
      subject: '',
      sentBy: null,
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
