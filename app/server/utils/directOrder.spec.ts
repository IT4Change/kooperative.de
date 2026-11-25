// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMockDb } from '../../test/helpers/mock-db'

import { placeDirectOrder } from './directOrder'
import { buildCustomerOrderReceived, buildAdminNewOrder } from './pendingMail'

import type { OrderComputation, OrderInput } from './orderCompute'
import type { H3Event } from 'h3'

const createPendingOrder = vi.hoisted(() => vi.fn())
const getPendingById = vi.hoisted(() => vi.fn())
const materializePending = vi.hoisted(() => vi.fn())
const findPendingByIdempotencyKey = vi.hoisted(() => vi.fn())
vi.mock(import('./pendingOrder'), () => ({
  createPendingOrder,
  findPendingByIdempotencyKey,
  getPendingById,
  materializePending,
}))

const sendAndLogOrderMail = vi.hoisted(() => vi.fn())
vi.mock(import('./orderMailLog'), () => ({ sendAndLogOrderMail }))

vi.mock(import('./links'), () => ({
  reviewLink: (_e: unknown, token: string) => `https://shop.example.org/bestaetigen?token=${token}`,
  adminOrderLink: (_e: unknown, id: number) => `https://shop.example.org/admin/orders/${id}`,
}))
const TERMS = [{ slug: 'agb', title: 'AGB', versionNo: 3, html: 'h', text: 't' }]
const loadContractTerms = vi.hoisted(() => vi.fn())
vi.mock(import('./contractTerms'), () => ({ loadContractTerms }))
vi.mock(import('./mailer'), () => ({ MAIL_OPERATOR: 'betrieb@example.org' }))
vi.mock(import('./pendingMail'), () => ({
  buildCustomerOrderReceived: vi.fn(() => ({ subject: 'cs', text: 'ct', html: 'ch' })),
  buildAdminNewOrder: vi.fn(() => ({ subject: 'as', text: 'at', html: 'ah' })),
}))

/**
 * The standard-shop checkout: one call turns the cart into an osCommerce order
 * and tells both sides. What matters is that the order really lands (status 1
 * via materialise, marked 'direct') before any mail claims it did, and that the
 * customer's mail is the receipt with the review link.
 */
const EVENT = {} as H3Event
const INPUT = { items: [], shippingMethod: 'abholung', paymentMethod: 'vorkasse' } as OrderInput
const COMP = {
  customer: { customerId: 3, email: 'kundin@example.org', name: 'Erika Musterfrau' },
  total: 23.8,
} as unknown as OrderComputation
const PENDING = { id: 12, token: 'tok', status: 'pending' }

beforeEach(() => {
  vi.clearAllMocks()
  createPendingOrder.mockResolvedValue({ id: 12, token: 'tok' })
  getPendingById.mockResolvedValue(PENDING)
  materializePending.mockResolvedValue({ ordersId: 55, alreadyDone: false })
  sendAndLogOrderMail.mockResolvedValue({ status: 'sent', errorMessage: null })
  loadContractTerms.mockResolvedValue(TERMS)
  findPendingByIdempotencyKey.mockResolvedValue(null)
})

describe('placeDirectOrder', () => {
  it('records the order with its pinned snapshot', async () => {
    const db = createMockDb()

    await placeDirectOrder(db.pool, EVENT, { input: INPUT, comp: COMP }, { remoteIp: '10.0.0.1' })

    expect(createPendingOrder).toHaveBeenCalledWith(
      db.pool,
      {
        customerId: 3,
        email: 'kundin@example.org',
        payload: { input: INPUT, comp: COMP },
        total: 23.8,
      },
      { remoteIp: '10.0.0.1' },
    )
  })

  it('materialises it at once, marked as a direct order', async () => {
    const db = createMockDb()

    const result = await placeDirectOrder(db.pool, EVENT, { input: INPUT, comp: COMP })

    expect(getPendingById).toHaveBeenCalledWith(db.pool, 12)
    expect(materializePending).toHaveBeenCalledWith(db.pool, PENDING, 'direct', {})
    expect(result).toStrictEqual({ ordersId: 55, pendingId: 12, replayed: false })
  })

  it('sends the receipt to the customer and the new order to the operator', async () => {
    const db = createMockDb()

    await placeDirectOrder(db.pool, EVENT, { input: INPUT, comp: COMP })

    expect(sendAndLogOrderMail).toHaveBeenCalledTimes(2)
    const [[, toCustomer], [, toAdmin]] = sendAndLogOrderMail.mock.calls
    expect(toCustomer).toMatchObject({
      direction: 'to_customer',
      recipient: 'kundin@example.org',
      mailType: 'order_received',
      ordersId: 55,
      pendingOrderId: 12,
      sentBy: 'system',
    })
    expect(toAdmin).toMatchObject({
      direction: 'to_admin',
      recipient: 'betrieb@example.org',
      mailType: 'admin_new_order',
      ordersId: 55,
      // The operator answers the customer straight from the mail.
      replyTo: 'kundin@example.org',
    })
  })

  it('links the customer to the review page and the operator into the admin', async () => {
    const db = createMockDb()

    await placeDirectOrder(db.pool, EVENT, { input: INPUT, comp: COMP })

    expect(buildCustomerOrderReceived).toHaveBeenCalledWith({
      orderId: 55,
      comp: COMP,
      reviewUrl: 'https://shop.example.org/bestaetigen?token=tok',
      // The live AGB and Widerrufsbelehrung travel with the receipt.
      terms: TERMS,
    })
    expect(loadContractTerms).toHaveBeenCalledWith(db.pool)
    expect(buildAdminNewOrder).toHaveBeenCalledWith({
      orderId: 55,
      comp: COMP,
      adminUrl: 'https://shop.example.org/admin/orders/55',
    })
  })

  it('sends no mail when the order could not be written', async () => {
    materializePending.mockRejectedValue(new Error('db down'))
    const db = createMockDb()

    // The record stays 'pending' and surfaces in the admin for a manual release;
    // no mail may claim an order that does not exist in osCommerce.
    await expect(placeDirectOrder(db.pool, EVENT, { input: INPUT, comp: COMP })).rejects.toThrow(
      'db down',
    )
    expect(sendAndLogOrderMail).not.toHaveBeenCalled()
  })

  it('fails loudly when the fresh record cannot be read back', async () => {
    getPendingById.mockResolvedValue(null)
    const db = createMockDb()

    await expect(
      placeDirectOrder(db.pool, EVENT, { input: INPUT, comp: COMP }),
    ).rejects.toMatchObject({ statusCode: 500 })
    expect(materializePending).not.toHaveBeenCalled()
  })

  describe('a repeated checkout attempt (idempotency key)', () => {
    const KEY = '2f1c7a52-8c4e-4b8e-9f00-0123456789ab'
    const DONE = { id: 9, status: 'materialized', ordersId: 44 }

    it('stores the key with the order', async () => {
      const db = createMockDb()

      await placeDirectOrder(db.pool, EVENT, { input: INPUT, comp: COMP, idempotencyKey: KEY })

      expect(findPendingByIdempotencyKey).toHaveBeenCalledWith(db.pool, 3, KEY)
      expect(createPendingOrder).toHaveBeenCalledWith(
        db.pool,
        expect.objectContaining({ idempotencyKey: KEY }),
        {},
      )
    })

    it('answers with the first order instead of placing a second one', async () => {
      findPendingByIdempotencyKey.mockResolvedValue(DONE)

      const result = await placeDirectOrder(createMockDb().pool, EVENT, {
        input: INPUT,
        comp: COMP,
        idempotencyKey: KEY,
      })

      expect(result).toStrictEqual({ ordersId: 44, pendingId: 9, replayed: true })
      expect(createPendingOrder).not.toHaveBeenCalled()
      // The customer already has the receipt; a second one would read as a
      // second order.
      expect(sendAndLogOrderMail).not.toHaveBeenCalled()
    })

    it('refuses with 409 while the first attempt has no order number yet', async () => {
      findPendingByIdempotencyKey.mockResolvedValue({ id: 9, status: 'pending', ordersId: null })

      await expect(
        placeDirectOrder(createMockDb().pool, EVENT, {
          input: INPUT,
          comp: COMP,
          idempotencyKey: KEY,
        }),
      ).rejects.toMatchObject({ statusCode: 409 })
      expect(createPendingOrder).not.toHaveBeenCalled()
    })

    it('hands the loser of a race the winner’s order', async () => {
      // Both requests found nothing; the unique key let only one insert through.
      findPendingByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(DONE)
      createPendingOrder.mockRejectedValue(Object.assign(new Error('Duplicate'), { errno: 1062 }))

      const result = await placeDirectOrder(createMockDb().pool, EVENT, {
        input: INPUT,
        comp: COMP,
        idempotencyKey: KEY,
      })

      expect(result).toMatchObject({ ordersId: 44, replayed: true })
      expect(materializePending).not.toHaveBeenCalled()
    })

    it('passes any other insert failure on', async () => {
      createPendingOrder.mockRejectedValue(Object.assign(new Error('gone'), { errno: 2006 }))

      await expect(
        placeDirectOrder(createMockDb().pool, EVENT, {
          input: INPUT,
          comp: COMP,
          idempotencyKey: KEY,
        }),
      ).rejects.toThrow('gone')
    })

    it('passes a duplicate on when the winner cannot be found either', async () => {
      createPendingOrder.mockRejectedValue(Object.assign(new Error('Duplicate'), { errno: 1062 }))

      await expect(
        placeDirectOrder(createMockDb().pool, EVENT, {
          input: INPUT,
          comp: COMP,
          idempotencyKey: KEY,
        }),
      ).rejects.toThrow('Duplicate')
    })

    it('does not look anything up without a key', async () => {
      createPendingOrder.mockRejectedValue(Object.assign(new Error('Duplicate'), { errno: 1062 }))

      await expect(
        placeDirectOrder(createMockDb().pool, EVENT, { input: INPUT, comp: COMP }),
      ).rejects.toThrow('Duplicate')
      expect(findPendingByIdempotencyKey).not.toHaveBeenCalled()
    })
  })
})
