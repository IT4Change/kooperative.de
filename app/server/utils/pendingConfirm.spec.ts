// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMockDb } from '../../test/helpers/mock-db'

import { confirmPending } from './pendingConfirm'

import type { PendingRow } from './pendingOrder'
import type { H3Event } from 'h3'

const materializePending = vi.hoisted(() => vi.fn())
vi.mock(import('./pendingOrder'), () => ({ materializePending }))

const sendAndLogOrderMail = vi.hoisted(() => vi.fn())
vi.mock(import('./orderMailLog'), () => ({ sendAndLogOrderMail }))

vi.mock(import('./links'), () => ({
  reviewLink: (_e: unknown, token: string) => `https://shop.example.org/bestaetigen?token=${token}`,
  adminOrderLink: (_e: unknown, id: number) => `https://shop.example.org/admin/orders/${id}`,
}))
vi.mock(import('./mailer'), () => ({ MAIL_OPERATOR: 'betrieb@example.org' }))
vi.mock(import('./pendingMail'), () => ({
  buildCustomerConfirmed: vi.fn(() => ({ subject: 'cs', text: 'ct', html: 'ch' })),
  buildAdminConfirmed: vi.fn(() => ({ subject: 'as', text: 'at', html: 'ah' })),
}))

/**
 * Ties confirmation together: materialise the order, then tell both sides. The
 * property worth guarding is that a repeated confirmation stays silent — a
 * customer clicking the link twice must not trigger a second round of mails.
 */
const EVENT = {} as H3Event

const PENDING = {
  id: 12,
  token: 'tok',
  customersId: 3,
  email: 'kundin@example.org',
  payload: { input: {}, comp: { customer: { email: 'kundin@example.org' } } },
  total: 23.8,
  status: 'pending',
  ordersId: null,
} as unknown as PendingRow

beforeEach(() => {
  vi.clearAllMocks()
  materializePending.mockResolvedValue({ ordersId: 55, alreadyDone: false })
  sendAndLogOrderMail.mockResolvedValue({ status: 'sent', errorMessage: null })
})

describe('confirmPending', () => {
  it('materialises the order and reports its id', async () => {
    const db = createMockDb()

    const result = await confirmPending(db.pool, EVENT, PENDING, 'link', { remoteIp: '10.0.0.1' })

    expect(result).toStrictEqual({ ordersId: 55, alreadyDone: false })
    expect(materializePending).toHaveBeenCalledWith(db.pool, PENDING, 'link', {
      remoteIp: '10.0.0.1',
    })
  })

  it('notifies the customer and the operator', async () => {
    const db = createMockDb()

    await confirmPending(db.pool, EVENT, PENDING, 'link')

    expect(sendAndLogOrderMail).toHaveBeenCalledTimes(2)
    const [[, toCustomer], [, toAdmin]] = sendAndLogOrderMail.mock.calls
    expect(toCustomer).toMatchObject({
      direction: 'to_customer',
      recipient: 'kundin@example.org',
      mailType: 'order_confirmed',
      ordersId: 55,
      pendingOrderId: 12,
    })
    expect(toAdmin).toMatchObject({
      direction: 'to_admin',
      recipient: 'betrieb@example.org',
      mailType: 'admin_order_confirmed',
    })
  })

  it('lets the operator reply straight to the customer', async () => {
    const db = createMockDb()

    await confirmPending(db.pool, EVENT, PENDING, 'link')

    expect(sendAndLogOrderMail.mock.calls[1][1].replyTo).toBe('kundin@example.org')
  })

  it('sends nothing more when the order was already confirmed', async () => {
    materializePending.mockResolvedValue({ ordersId: 55, alreadyDone: true })
    const db = createMockDb()

    const result = await confirmPending(db.pool, EVENT, PENDING, 'link')

    // Clicking the confirmation link twice must not mail the customer twice.
    expect(result.alreadyDone).toBe(true)
    expect(sendAndLogOrderMail).not.toHaveBeenCalled()
  })

  it.each([
    ['link', 'system'],
    ['reply', 'system'],
    ['admin', 'admin'],
  ])('records who confirmed via %s as %s', async (via, sentBy) => {
    const db = createMockDb()

    await confirmPending(db.pool, EVENT, PENDING, via as 'link' | 'reply' | 'admin')

    // The mail history has to distinguish a customer confirmation from an
    // operator confirming on their behalf.
    expect(sendAndLogOrderMail.mock.calls[0][1].sentBy).toBe(sentBy)
    expect(sendAndLogOrderMail.mock.calls[1][1].sentBy).toBe(sentBy)
  })
})
