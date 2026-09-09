// @vitest-environment node
import { describe, it, expect } from 'vitest'

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
    // orders_total joins module + title, so the colon suffix must be present.
    // Casing is not normalized — the old shop wrote "Versand mit EXPRESS:".
    expect(opt.totalTitle.toLowerCase()).toBe(`${opt.module.toLowerCase()}:`)
    expect(opt.net).toBeGreaterThanOrEqual(0)
  })

  it("keeps the old shop's upper-case EXPRESS spelling", () => {
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
