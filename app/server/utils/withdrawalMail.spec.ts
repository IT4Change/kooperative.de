// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { buildAdminWithdrawal, buildWithdrawalReceipt, receivedAt } from './withdrawalMail'

import type { Withdrawal } from './withdrawal'

/**
 * § 356a Abs. 4 BGB: the receipt must carry the declaration's content and the
 * date and time it arrived. The whole-mail snapshots are in mailSnapshots.spec;
 * this pins the parts the law and the operator rely on.
 */
const W: Withdrawal = {
  id: 3,
  name: 'Erika Musterfrau',
  email: 'kundin@example.org',
  orderRef: '55',
  scope: 'all',
  items: null,
  message: null,
  ordersId: 55,
  customersId: 3,
  createdAt: '2026-07-01T10:30:00.000Z',
}

describe('receivedAt', () => {
  it('gives the German local time, also in summer', () => {
    // 10:30 UTC is 12:30 in Dürnau under CEST.
    expect(receivedAt('2026-07-01T10:30:00.000Z')).toBe('01.07.2026 um 12:30 Uhr')
    expect(receivedAt('2026-12-01T10:30:00.000Z')).toBe('01.12.2026 um 11:30 Uhr')
  })
})

describe('buildWithdrawalReceipt', () => {
  const mail = buildWithdrawalReceipt(W)

  it('says when the declaration arrived', () => {
    expect(mail.text).toContain('am 01.07.2026 um 12:30 Uhr bei uns eingegangen')
    expect(mail.html).toContain('am 01.07.2026 um 12:30 Uhr bei uns eingegangen')
  })

  it('repeats what was declared', () => {
    expect(mail.text).toContain('Bestellung: 55')
    expect(mail.text).toContain('Umfang: gesamte Bestellung')
    expect(mail.text).not.toContain('Artikel:')
    expect(mail.text).not.toContain('Nachricht:')
  })

  it('escapes what the customer typed', () => {
    const hostile = buildWithdrawalReceipt({
      ...W,
      scope: 'partial',
      items: '<b>alles</b>',
      name: '<i>x</i>',
    })

    expect(hostile.html).not.toContain('<b>alles</b>')
    expect(hostile.html).toContain('&lt;b&gt;alles&lt;/b&gt;')
    expect(hostile.html).not.toContain('<i>x</i>')
  })
})

describe('buildAdminWithdrawal', () => {
  it('names the linked order', () => {
    const mail = buildAdminWithdrawal(W, 'https://shop.example.org/admin/orders/55')

    expect(mail.text).toContain('Zugeordnet zu Bestellung #55.')
    expect(mail.text).toContain('Im Admin öffnen: https://shop.example.org/admin/orders/55')
  })

  it('asks for a manual assignment when nothing matched', () => {
    const mail = buildAdminWithdrawal(
      { ...W, ordersId: null },
      'https://shop.example.org/admin/withdrawals',
    )

    expect(mail.text).toContain('bitte von Hand zuordnen')
  })
})
