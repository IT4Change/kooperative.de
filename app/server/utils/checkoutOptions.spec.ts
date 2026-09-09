// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  SHIPPING_OPTIONS as CLIENT_SHIPPING,
  PAYMENT_OPTIONS as CLIENT_PAYMENT,
} from '../../app/data/checkoutOptions'

import { SHIPPING_OPTIONS, SHIPPING_ORDER, PAYMENT_OPTIONS, PAYMENT_ORDER } from './checkoutOptions'

/**
 * These options are mirrored from the old osCommerce shipping/payment modules and
 * are written verbatim into the orders tables. The tests pin the invariants that
 * keep new orders indistinguishable from old-shop ones.
 */
describe('SHIPPING_OPTIONS', () => {
  it('offers exactly the methods listed in SHIPPING_ORDER, without duplicates', () => {
    expect([...SHIPPING_ORDER].sort()).toStrictEqual(Object.keys(SHIPPING_OPTIONS).sort())
    expect(new Set(SHIPPING_ORDER).size).toBe(SHIPPING_ORDER.length)
  })

  it.each(SHIPPING_ORDER)('%s carries a complete, well-formed option', (method) => {
    const opt = SHIPPING_OPTIONS[method]
    expect(opt.module).not.toBe('')
    expect(opt.description).not.toBe('')
    // Character for character, casing included: the customer reads `module` in
    // the mails and `totalTitle` lands in orders_total for the same order.
    expect(opt.totalTitle).toBe(`${opt.module}:`)
    expect(opt.net).toBeGreaterThanOrEqual(0)
  })

  it("keeps the old shop's upper-case EXPRESS spelling", () => {
    // The only spelling that appears in the shop's order data. The legacy
    // module also carries a mixed-case "Versand mit Express" in a field
    // osCommerce never writes to an order — that one must not leak back in.
    expect(SHIPPING_OPTIONS.express.module).toBe('Versand mit EXPRESS')
    expect(SHIPPING_OPTIONS.express.totalTitle).toBe('Versand mit EXPRESS:')
  })

  it('taxes exactly those options that have a fixed price', () => {
    for (const method of SHIPPING_ORDER) {
      const opt = SHIPPING_OPTIONS[method]
      expect(opt.taxClassId).toBe(opt.net > 0 ? 2 : 0)
    }
  })

  it('shows "nach Aufwand" exactly for the options without a fixed price', () => {
    for (const method of SHIPPING_ORDER) {
      const opt = SHIPPING_OPTIONS[method]
      expect(opt.displayPrice === 'nach Aufwand').toBe(opt.net === 0)
    }
  })

  it('keeps the net prices consistent with the advertised gross prices (19% VAT)', () => {
    const gross = (net: number) => Math.round(net * 1.19 * 100) / 100
    expect(gross(SHIPPING_OPTIONS.dpd.net)).toBe(7.5)
    expect(gross(SHIPPING_OPTIONS.dhl.net)).toBe(12)
  })
})

describe('PAYMENT_OPTIONS', () => {
  it('offers exactly the methods listed in PAYMENT_ORDER, without duplicates', () => {
    expect([...PAYMENT_ORDER].sort()).toStrictEqual(Object.keys(PAYMENT_OPTIONS).sort())
    expect(new Set(PAYMENT_ORDER).size).toBe(PAYMENT_ORDER.length)
  })

  it('keeps the labels the old shop wrote into orders.payment_method', () => {
    expect(PAYMENT_OPTIONS.vorkasse.label).toBe('Bezahlung mit Vorkasse')
    expect(PAYMENT_OPTIONS.rechnung.label).toBe('Bezahlung mit Rechnung')
    expect(PAYMENT_OPTIONS.lastschrift.label).toBe('Lastschriftverfahren IBAN (DE)')
  })
})

/**
 * `app/data/checkoutOptions.ts` is a second copy of this list, so the checkout
 * can render without pulling the server module into the bundle. Both halves are
 * customer-facing for the *same* order — the shop shows one, the mail shows the
 * other — so a divergence is visible to the customer, not merely cosmetic. That
 * is exactly how "Versand mit EXPRESS" and "Versand mit Express" came to stand
 * side by side; these tests are what keeps it from happening again.
 */
describe('the client copy', () => {
  it('lists the methods in the order the server prescribes', () => {
    expect(CLIENT_SHIPPING.map((o) => o.id)).toStrictEqual(SHIPPING_ORDER)
  })

  it.each(SHIPPING_ORDER)('spells %s identically on both sides', (method) => {
    const client = CLIENT_SHIPPING.find((o) => o.id === method)
    const server = SHIPPING_OPTIONS[method]

    expect(client?.module).toBe(server.module)
    expect(client?.description).toBe(server.description)
    expect(client?.price).toBe(server.displayPrice)
  })

  it('offers exactly the payment methods the server accepts, worded the same', () => {
    expect(CLIENT_PAYMENT.map((o) => o.id)).toStrictEqual(PAYMENT_ORDER)
    for (const option of CLIENT_PAYMENT) {
      expect(option.label).toBe(PAYMENT_OPTIONS[option.id].label)
    }
  })
})
