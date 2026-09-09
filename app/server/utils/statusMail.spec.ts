// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { buildStatusMail } from './statusMail'

/** The notification a customer gets when the operator moves their order along. */
describe('buildStatusMail', () => {
  const CTX = { orderId: 55, customerName: 'Erika Musterfrau', statusName: 'Versendet' }

  it('names order and new status in the subject', () => {
    expect(buildStatusMail(CTX).subject).toBe('[Kooperative Dürnau] Bestellung #55 – Versendet')
  })

  it('states the new status in the body', () => {
    const { text, html } = buildStatusMail(CTX)

    expect(text).toContain('Bestellung #55')
    expect(text).toContain('Versendet')
    expect(html).toContain('Versendet')
  })

  it('greets the customer by name', () => {
    expect(buildStatusMail(CTX).text).toContain('Hallo Erika Musterfrau,')
  })

  it('falls back to a neutral greeting without a name', () => {
    expect(buildStatusMail({ ...CTX, customerName: '' }).text).toContain('Hallo,')
  })

  it('includes the operator comment when there is one', () => {
    const { text } = buildStatusMail({ ...CTX, comment: 'Paket ging heute raus' })

    expect(text).toContain('Anmerkung')
    expect(text).toContain('Paket ging heute raus')
  })

  it('omits the comment block when there is none', () => {
    expect(buildStatusMail(CTX).text).not.toContain('Anmerkung')
  })

  it('carries the company footer', () => {
    expect(buildStatusMail(CTX).text).toContain('Kooperative Dürnau')
  })

  it('escapes hostile input in the HTML part', () => {
    const { html } = buildStatusMail({ ...CTX, comment: '<img src=x onerror=alert(1)>' })

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
