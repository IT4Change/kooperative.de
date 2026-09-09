// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMockDb } from '../../test/helpers/mock-db'

import { sendAndLogOrderMail } from './orderMailLog'

const sendMail = vi.hoisted(() => vi.fn())
vi.mock(import('./mailer'), () => ({
  getMailer: () => ({ sendMail }),
  MAIL_FROM: 'shop@example.org',
  MAIL_OPERATOR: 'betrieb@example.org',
}))

const dbInsert = vi.hoisted(() => vi.fn())
vi.mock(import('./dbWrite'), () => ({ dbInsert }))

/**
 * Every mail belonging to an order goes through here so the admin can show a
 * complete history. The important property is that neither half can lose the
 * other: a failed send is still recorded, and a failed log write still returns
 * the send result instead of taking the request down with it.
 */
const loggedRow = () => dbInsert.mock.calls.at(-1)?.[2] as Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  sendMail.mockResolvedValue(undefined)
  dbInsert.mockResolvedValue(1)
})

describe('sendAndLogOrderMail', () => {
  it('sends the mail and records it as sent', async () => {
    const db = createMockDb()

    const result = await sendAndLogOrderMail(db.pool, {
      ordersId: 5,
      direction: 'to_customer',
      recipient: 'kunde@example.org',
      mailType: 'order_confirmation',
      subject: 'Ihre Bestellung',
      text: 'Danke',
      html: '<p>Danke</p>',
    })

    expect(result).toStrictEqual({ status: 'sent', errorMessage: null })
    expect(sendMail).toHaveBeenCalledWith({
      from: 'shop@example.org',
      to: 'kunde@example.org',
      replyTo: 'betrieb@example.org',
      subject: 'Ihre Bestellung',
      text: 'Danke',
      html: '<p>Danke</p>',
    })
    expect(loggedRow()).toMatchObject({
      orders_id: 5,
      pending_order_id: null,
      direction: 'to_customer',
      mail_type: 'order_confirmation',
      status: 'sent',
      error_message: null,
      sent_by: 'system',
    })
  })

  it('lets the customer reply to the operator, not to the no-reply sender', async () => {
    const db = createMockDb()

    await sendAndLogOrderMail(db.pool, {
      direction: 'to_customer',
      recipient: 'kunde@example.org',
      mailType: 'x',
      subject: 's',
    })

    expect(sendMail.mock.calls[0][0].replyTo).toBe('betrieb@example.org')
  })

  it('honours an explicit reply-to', async () => {
    const db = createMockDb()

    await sendAndLogOrderMail(db.pool, {
      direction: 'to_admin',
      recipient: 'betrieb@example.org',
      mailType: 'x',
      subject: 's',
      replyTo: 'kunde@example.org',
    })

    expect(sendMail.mock.calls[0][0].replyTo).toBe('kunde@example.org')
  })

  it('records a failed send instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sendMail.mockRejectedValue(new Error('smtp unreachable'))
    const db = createMockDb()

    const result = await sendAndLogOrderMail(db.pool, {
      ordersId: 5,
      direction: 'to_customer',
      recipient: 'kunde@example.org',
      mailType: 'order_confirmation',
      subject: 'Ihre Bestellung',
    })

    // The caller has already committed the order — a dead mail server must not
    // undo that, but it has to be visible in the history.
    expect(result).toStrictEqual({ status: 'failed', errorMessage: 'smtp unreachable' })
    expect(loggedRow()).toMatchObject({ status: 'failed', error_message: 'smtp unreachable' })
    error.mockRestore()
  })

  it('truncates an overlong error message to the column length', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sendMail.mockRejectedValue(new Error('x'.repeat(900)))
    const db = createMockDb()

    const result = await sendAndLogOrderMail(db.pool, {
      direction: 'to_customer',
      recipient: 'k@example.org',
      mailType: 'x',
      subject: 's',
    })

    expect(result.errorMessage).toHaveLength(500)
  })

  it('handles a rejection that is not an Error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sendMail.mockRejectedValue('plain string failure')
    const db = createMockDb()

    const result = await sendAndLogOrderMail(db.pool, {
      direction: 'to_customer',
      recipient: 'k@example.org',
      mailType: 'x',
      subject: 's',
    })

    expect(result.errorMessage).toBe('plain string failure')
  })

  it('still reports the send result when the log write fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    dbInsert.mockRejectedValue(new Error('table missing'))
    const db = createMockDb()

    const result = await sendAndLogOrderMail(db.pool, {
      direction: 'to_customer',
      recipient: 'k@example.org',
      mailType: 'x',
      subject: 's',
    })

    expect(result.status).toBe('sent')
    expect(error).toHaveBeenCalledWith('[orderMail] log write failed:', expect.any(Error))
    error.mockRestore()
  })

  it('links a mail that belongs to a pending order rather than a real one', async () => {
    const db = createMockDb()

    await sendAndLogOrderMail(db.pool, {
      pendingOrderId: 12,
      direction: 'to_admin',
      recipient: 'betrieb@example.org',
      mailType: 'new_pending',
      subject: 's',
      sentBy: 'anna',
      relatedStatusId: 3,
    })

    expect(loggedRow()).toMatchObject({
      orders_id: null,
      pending_order_id: 12,
      sent_by: 'anna',
      related_status_id: 3,
    })
  })
})
