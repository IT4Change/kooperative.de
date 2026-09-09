// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  SHIPPING_OPTIONS as SERVER_SHIPPING,
  PAYMENT_OPTIONS as SERVER_PAYMENT,
} from '../../server/utils/checkoutOptions'

import { SHIPPING_OPTIONS, PAYMENT_OPTIONS } from './checkoutOptions'

/**
 * The customer-facing labels are a second copy of the server's option list —
 * the client needs them without pulling in the server module. A copy that drifts
 * would let the checkout offer something the server then rejects, so the two are
 * compared against each other here.
 */
describe('shipping options', () => {
  it('offers exactly the methods the server accepts', () => {
    expect(SHIPPING_OPTIONS.map((o) => o.id).sort()).toStrictEqual(
      Object.keys(SERVER_SHIPPING).sort(),
    )
  })

  it('uses the same module names', () => {
    for (const option of SHIPPING_OPTIONS) {
      // Case-insensitive: the client label follows the server's totalTitle
      // ("Versand mit EXPRESS:"), the module field spells it "Express". A
      // cosmetic divergence — the id is what travels — but pinned rather than
      // quietly corrected, because the wording is customer-facing copy.
      expect(option.module.toLowerCase()).toBe(SERVER_SHIPPING[option.id].module.toLowerCase())
    }
  })

  it('keeps the upper-case EXPRESS spelling the shop uses', () => {
    const express = SHIPPING_OPTIONS.find((o) => o.id === 'express')
    expect(express?.module).toBe('Versand mit EXPRESS')
    expect(SERVER_SHIPPING.express.totalTitle).toBe('Versand mit EXPRESS:')
  })

  it('shows the same price as the server advertises', () => {
    for (const option of SHIPPING_OPTIONS) {
      expect(option.price).toBe(SERVER_SHIPPING[option.id].displayPrice)
    }
  })

  it('describes every option', () => {
    for (const option of SHIPPING_OPTIONS) {
      expect(option.description).not.toBe('')
    }
  })
})

describe('payment options', () => {
  it('offers exactly the methods the server accepts', () => {
    expect(PAYMENT_OPTIONS.map((o) => o.id).sort()).toStrictEqual(
      Object.keys(SERVER_PAYMENT).sort(),
    )
  })

  it('uses the labels the server writes into orders.payment_method', () => {
    for (const option of PAYMENT_OPTIONS) {
      expect(option.label).toBe(SERVER_PAYMENT[option.id].label)
    }
  })
})
