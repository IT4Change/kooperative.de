// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../test/setup-server'
import { callHandler } from '../../test/helpers/event'
import { createMockDb } from '../../test/helpers/mock-db'
import { LIMITS, resetRateLimits } from '../utils/rateLimit'

import withdrawal from './withdrawal.post'

const recordWithdrawal = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/withdrawal'), () => ({ recordWithdrawal }))
const sendAndLogOrderMail = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/orderMailLog'), () => ({ sendAndLogOrderMail }))
vi.mock(import('../utils/mailer'), () => ({ MAIL_OPERATOR: 'betrieb@example.org' }))

/**
 * The confirmation step of the withdrawal function. What matters: no login,
 * the same answer whether or not the order matched (no probing of order
 * numbers), the receipt always goes out, and foreign pages cannot file
 * declarations.
 */
const BODY = { name: 'Erika Musterfrau', email: 'kundin@example.org', orderRef: '55' }
const STORED = {
  id: 3,
  ...BODY,
  scope: 'all',
  items: null,
  message: null,
  ordersId: 55,
  customersId: 3,
  createdAt: '2026-11-17T13:03:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimits()
  globalThis.useDB = (() => createMockDb().pool) as never
  recordWithdrawal.mockResolvedValue(STORED)
  sendAndLogOrderMail.mockResolvedValue({ status: 'sent', errorMessage: null })
})

const post = async (body: unknown = BODY, headers: Record<string, string> = {}) =>
  callHandler<{ ok: boolean; receivedAt: string }>(withdrawal, { method: 'POST', body, headers })

describe('POST /api/withdrawal', () => {
  it('records the declaration without a login and reports when it arrived', async () => {
    await expect(post()).resolves.toStrictEqual({
      ok: true,
      receivedAt: '2026-11-17T13:03:00.000Z',
    })
    expect(recordWithdrawal).toHaveBeenCalledWith(expect.anything(), {
      name: 'Erika Musterfrau',
      email: 'kundin@example.org',
      orderRef: '55',
      scope: 'all',
    })
  })

  it('sends the receipt to the customer and the notice to the operator, on the order', async () => {
    await post()

    const [[, toCustomer], [, toAdmin]] = sendAndLogOrderMail.mock.calls
    expect(toCustomer).toMatchObject({
      ordersId: 55,
      direction: 'to_customer',
      recipient: 'kundin@example.org',
      mailType: 'withdrawal_received',
    })
    expect(toAdmin).toMatchObject({
      ordersId: 55,
      direction: 'to_admin',
      recipient: 'betrieb@example.org',
      mailType: 'admin_withdrawal',
      replyTo: 'kundin@example.org',
    })
    expect(toAdmin.text).toContain('/admin/orders/55')
  })

  it('answers the same for a declaration that matches no order', async () => {
    recordWithdrawal.mockResolvedValue({ ...STORED, ordersId: null, customersId: null })

    await expect(post()).resolves.toStrictEqual({ ok: true, receivedAt: STORED.createdAt })
    // Still a declaration: the customer gets the receipt, the operator assigns it.
    expect(sendAndLogOrderMail).toHaveBeenCalledTimes(2)
    expect(sendAndLogOrderMail.mock.calls[1][1].text).toContain('/admin/withdrawals')
  })

  it('refuses a declaration posted from a foreign page', async () => {
    await expect(post(BODY, { 'sec-fetch-site': 'cross-site' })).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(recordWithdrawal).not.toHaveBeenCalled()
  })

  it('rejects an incomplete declaration', async () => {
    await expect(post({ ...BODY, orderRef: '' })).rejects.toMatchObject({ statusCode: 400 })
    expect(recordWithdrawal).not.toHaveBeenCalled()
  })

  it('stops a flood from one address, but only far above any real use', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i < LIMITS.withdrawalsPerEmail.max; i++) await post()

    await expect(post()).rejects.toMatchObject({ statusCode: 429 })
  })

  it('counts the IP budget before reading anything', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i < LIMITS.withdrawalsPerIp.max; i++) {
      await post({ ...BODY, email: `k${i}@example.org` })
    }

    await expect(post({ ...BODY, email: 'neu@example.org' })).rejects.toMatchObject({
      statusCode: 429,
    })
  })
})
