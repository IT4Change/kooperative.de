// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { buildOrderMail, countryName } from './orderMail'

import type { OrderMailContext } from './orderMail'

/**
 * The operator's order mail. It is the working document for whoever packs the
 * order, so it has to carry the delivery address, every line, and the payment
 * details — including the bank details, which arrive nowhere else in this mail.
 */
const CTX: OrderMailContext = {
  orderId: 55,
  customer: {
    customerId: 3,
    firstname: 'Erika',
    lastname: 'Musterfrau',
    email: 'kundin@example.org',
    telephone: '0711 1234567',
  },
  shipping: {
    street: 'Im Winkel 11',
    postcode: '88422',
    city: 'Dürnau',
    country: 'Deutschland',
  },
  items: [{ productId: '1', name: 'Honig', quantity: 2, unitPrice: 11.9, lineTotal: 23.8 }],
  total: 31.3,
  shippingMethod: 'Versand mit DPD',
  shippingPrice: 7.5,
  paymentMethod: 'Bezahlung mit Vorkasse',
}

describe('buildOrderMail', () => {
  it('puts order number and customer into the subject', () => {
    expect(buildOrderMail(CTX).subject).toBe(
      '[Koop · neuer Shop] Bestellung #55 – Erika Musterfrau',
    )
  })

  it('marks an unknown shipping cost and a missing phone number', () => {
    const { text, html } = buildOrderMail({
      ...CTX,
      shippingPrice: 0,
      customer: { ...CTX.customer, telephone: '' },
    })

    expect(text).toContain('nach Aufwand')
    expect(text).toContain('Tel.: –')
    expect(html).toContain('nach Aufwand')
    // No dangling separator where the number would be.
    expect(html).not.toContain('· Tel.')
  })

  it('lets the operator reply straight to the customer', () => {
    expect(buildOrderMail(CTX).replyTo).toBe('kundin@example.org')
  })

  it('carries the delivery address', () => {
    const { text } = buildOrderMail(CTX)

    expect(text).toContain('Im Winkel 11')
    expect(text).toContain('88422')
    expect(text).toContain('Dürnau')
    expect(text).toContain('Deutschland')
  })

  it('lists each item with quantity and line total', () => {
    const { text } = buildOrderMail(CTX)

    expect(text).toContain('Honig')
    // Note the decimal point: unlike the customer-facing mails, which format via
    // fmt() as "23,80 EURO", this internal mail uses toFixed(). Pinned as-is.
    expect(text).toContain('23.80')
    expect(text).toContain('31.30')
  })

  it('names shipping and payment method', () => {
    const { text } = buildOrderMail(CTX)

    expect(text).toContain('Versand mit DPD')
    expect(text).toContain('Bezahlung mit Vorkasse')
  })

  it('shows the variant size when the item has one', () => {
    const { text } = buildOrderMail({
      ...CTX,
      items: [{ ...CTX.items[0], variantSize: '0,5 L' }],
    })

    expect(text).toContain('0,5 L')
  })

  it('includes the bank details for a direct debit order', () => {
    const { text } = buildOrderMail({
      ...CTX,
      paymentMethod: 'Lastschriftverfahren IBAN (DE)',
      bankDetails: { accountHolder: 'Erika Musterfrau', iban: 'DE89370400440532013000' },
    })

    expect(text).toContain('Erika Musterfrau')
    expect(text).toContain('DE89370400440532013000')
  })

  it('includes the customer note when there is one', () => {
    const { text } = buildOrderMail({ ...CTX, notes: 'Bitte klingeln' })

    expect(text).toContain('Bitte klingeln')
  })

  it('links into the old admin when a base URL is configured', () => {
    const { text } = buildOrderMail({ ...CTX, adminBaseUrl: 'https://shop.example.org/admin/' })

    // Trailing slash trimmed, and the legacy deep link shape kept.
    expect(text).toContain('https://shop.example.org/admin/orders.php?oID=55')
  })

  it('leaves the link out when no base URL is configured', () => {
    expect(buildOrderMail(CTX).text).not.toContain('orders.php')
  })

  it('escapes hostile input in the HTML part', () => {
    const { html } = buildOrderMail({
      ...CTX,
      items: [{ ...CTX.items[0], name: '<script>alert(1)</script>' }],
    })

    expect(html).not.toContain('<script>')
  })
})

describe('countryName', () => {
  it.each([
    [81, 'Deutschland'],
    [14, 'Oesterreich'],
    [204, 'Schweiz'],
  ])('resolves the osCommerce country id %i', (id, name) => {
    expect(countryName(id)).toBe(name)
  })

  it('returns an empty string for a country the shop does not ship to', () => {
    expect(countryName(999)).toBe('')
  })
})
