// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  buildCustomerConfirmRequest,
  buildAdminNewPending,
  buildCustomerConfirmed,
  buildAdminConfirmed,
} from './pendingMail'

import type { OrderComputation } from './orderCompute'

/**
 * The four mails of the confirmation flow. They are the only channel through
 * which the contract actually comes about, so the tests check what a customer
 * has to be able to see: the items with their prices, the total, and the link
 * that confirms — plus that nothing they typed can inject markup.
 */
const COMP: OrderComputation = {
  customer: {
    customerId: 3,
    firstname: 'Erika',
    lastname: 'Musterfrau',
    name: 'Erika Musterfrau',
    company: null,
    street: 'Im Winkel 11',
    suburb: null,
    city: 'Dürnau',
    postcode: '88422',
    state: null,
    country: 'Deutschland',
    telephone: '0711',
    email: 'kundin@example.org',
  },
  lines: [
    {
      productId: 1,
      model: 'HON-1',
      name: 'Honig',
      priceNet: 10,
      unitGross: 11.9,
      tax: 19,
      quantity: 2,
      lineGross: 23.8,
    },
  ],
  subtotalGross: 23.8,
  taxRows: [{ description: 'Mehrwertsteuer', rate: 19, total: 3.8, sortOrder: 0 }],
  shipping: { module: 'Versand mit DPD', totalTitle: 'Versand mit DPD:', gross: 7.5 },
  payment: { label: 'Bezahlung mit Vorkasse', method: 'vorkasse' },
  total: 31.3,
}

const REVIEW_URL = 'https://shop.example.org/bestellung/bestaetigen?token=abc'
const ADMIN_URL = 'https://shop.example.org/admin/orders/55'

describe('buildCustomerConfirmRequest', () => {
  const mail = buildCustomerConfirmRequest({ pendingId: 12, comp: COMP, reviewUrl: REVIEW_URL })

  it('asks for confirmation in the subject', () => {
    expect(mail.subject).toBe('[Kooperative Dürnau] Bitte bestätigen Sie Ihre Bestellung')
  })

  it('offers both ways to confirm', () => {
    // The reply path is the legally relevant one and must not go missing.
    expect(mail.text).toContain(REVIEW_URL)
    expect(mail.text).toContain('auf diese E-Mail antworten')
    expect(mail.html).toContain(REVIEW_URL)
  })

  it('lists the items with quantity and line total', () => {
    expect(mail.text).toContain('Honig')
    expect(mail.text).toContain('23,80')
    expect(mail.html).toContain('Honig')
  })

  it('shows shipping and the grand total', () => {
    expect(mail.text).toContain('Versand mit DPD')
    expect(mail.text).toContain('31,30')
  })

  it('addresses the customer by name', () => {
    expect(mail.text).toContain('Hallo Erika Musterfrau,')
  })

  it('says "nach Aufwand" when the shipping cost is not fixed yet', () => {
    const collected = buildCustomerConfirmRequest({
      pendingId: 12,
      comp: {
        ...COMP,
        shipping: { module: 'Abholung', totalTitle: 'Abholung:', gross: 0 },
      },
      reviewUrl: REVIEW_URL,
    })

    // A zero here means "we will work it out", not "free".
    expect(collected.text).toContain('nach Aufwand')
    expect(collected.html).toContain('nach Aufwand')
  })

  it('falls back to a neutral greeting without a name', () => {
    const anonymous = buildCustomerConfirmRequest({
      pendingId: 12,
      comp: { ...COMP, customer: { ...COMP.customer, name: '' } },
      reviewUrl: REVIEW_URL,
    })

    expect(anonymous.text).toContain('Hallo,')
  })

  it('carries the company footer and the "not an invoice" note', () => {
    expect(mail.text).toContain('Kooperative Dürnau')
    expect(mail.text).toContain('keine Rechnung')
  })
})

describe('buildAdminNewPending', () => {
  const mail = buildAdminNewPending({ pendingId: 12, comp: COMP, adminUrl: ADMIN_URL })

  it('names the customer in the subject', () => {
    expect(mail.subject).toBe(
      '[Koop · neuer Shop] Neue Bestellung (unbestätigt) – Erika Musterfrau',
    )
  })

  it('links straight into the admin', () => {
    expect(mail.text).toContain(ADMIN_URL)
    expect(mail.html).toContain(ADMIN_URL)
  })

  it('states that the order is still waiting on the customer', () => {
    expect(mail.text).toContain('wartet auf die Bestätigung')
  })

  it('includes the customer address for a quick reply', () => {
    expect(mail.text).toContain('kundin@example.org')
  })
})

describe('a customer without a name on file', () => {
  it('greets them without one rather than with a gap', () => {
    const mail = buildCustomerConfirmed({
      orderId: 55,
      comp: { ...COMP, customer: { ...COMP.customer, name: '' } },
      reviewUrl: REVIEW_URL,
    })

    expect(mail.text).toContain('Hallo,')
    expect(mail.text).not.toContain('Hallo ,')
  })
})

describe('buildCustomerConfirmed', () => {
  const mail = buildCustomerConfirmed({ orderId: 55, comp: COMP, reviewUrl: REVIEW_URL })

  it('carries the order number in the subject', () => {
    expect(mail.subject).toBe('[Kooperative Dürnau] Bestellung #55 bestätigt')
  })

  it('repeats the full listing', () => {
    expect(mail.text).toContain('Honig')
    expect(mail.text).toContain('31,30')
  })
})

describe('buildAdminConfirmed', () => {
  it('says how the confirmation arrived', () => {
    const viaLink = buildAdminConfirmed({
      orderId: 55,
      comp: COMP,
      adminUrl: ADMIN_URL,
      via: 'link',
    })
    const viaAdmin = buildAdminConfirmed({
      orderId: 55,
      comp: COMP,
      adminUrl: ADMIN_URL,
      via: 'admin',
    })

    // The operator needs to tell a customer confirmation from their own.
    expect(viaLink.text).not.toBe(viaAdmin.text)
    expect(`${viaLink.subject}${viaLink.text}`).toMatch(/link|Link/)
  })

  it('links into the admin view of the new order', () => {
    const mail = buildAdminConfirmed({ orderId: 55, comp: COMP, adminUrl: ADMIN_URL, via: 'reply' })

    expect(mail.text).toContain(ADMIN_URL)
  })
})

describe('escaping', () => {
  it('does not let a customer name inject markup into the HTML mail', () => {
    const hostile = {
      ...COMP,
      customer: { ...COMP.customer, name: '<script>alert(1)</script>' },
    }

    const mail = buildCustomerConfirmRequest({
      pendingId: 1,
      comp: hostile,
      reviewUrl: REVIEW_URL,
    })

    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('escapes a product name too', () => {
    const hostile = {
      ...COMP,
      lines: [{ ...COMP.lines[0], name: 'Honig <b>fett</b>' }],
    }

    const mail = buildCustomerConfirmRequest({
      pendingId: 1,
      comp: hostile,
      reviewUrl: REVIEW_URL,
    })

    expect(mail.html).not.toContain('<b>fett</b>')
  })
})
