// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { unitPrice, findTierIndex, tierTotalPrice } from './products'

import type { ProductVariant } from './products'

/**
 * The client-side pricing helpers. They drive what the product card shows, and
 * they have to agree with what the server charges — see the tier resolution in
 * server/utils/orderCompute.ts.
 */
function variant(over: Partial<ProductVariant>): ProductVariant {
  return { productId: '1', size: '', price: 0, amount: 1, referenceUnit: 'L', image: '', ...over }
}

const TIERS: ProductVariant[] = [
  variant({ price: 2.38, minQty: 1 }),
  variant({ price: 1.79, minQty: 10 }),
  variant({ price: 1.5, minQty: 50 }),
]

describe('unitPrice', () => {
  it('divides the price by the reference amount', () => {
    // 9.52 € for 0,5 L is 19.04 €/L — that is what the card prints.
    expect(unitPrice(variant({ price: 9.52, amount: 0.5 }))).toBeCloseTo(19.04, 2)
  })

  it('leaves a one-unit variant unchanged', () => {
    expect(unitPrice(variant({ price: 17.85, amount: 1 }))).toBeCloseTo(17.85, 2)
  })
})

describe('findTierIndex', () => {
  it.each([
    [1, 0],
    [9, 0],
    [10, 1],
    [49, 1],
    [50, 2],
    [500, 2],
  ])('picks the right tier for %i pieces', (quantity, expected) => {
    expect(findTierIndex(TIERS, quantity)).toBe(expected)
  })

  it('falls back to the first tier below the smallest threshold', () => {
    expect(findTierIndex(TIERS, 0)).toBe(0)
  })

  it('ignores a variant without a threshold', () => {
    // Size variants have no minQty; they must not be mistaken for a tier.
    expect(findTierIndex([variant({ price: 1 }), variant({ price: 2 })], 100)).toBe(0)
  })

  it('handles a single tier', () => {
    expect(findTierIndex([variant({ price: 1, minQty: 1 })], 5)).toBe(0)
  })
})

describe('tierTotalPrice', () => {
  it('multiplies the applicable tier price by the quantity', () => {
    expect(tierTotalPrice(TIERS, 10)).toBeCloseTo(17.9, 2)
  })

  it('stays on the base price below the first threshold', () => {
    expect(tierTotalPrice(TIERS, 3)).toBeCloseTo(7.14, 2)
  })

  it('gets cheaper per piece as the quantity crosses a threshold', () => {
    // The whole point of tiers: 10 pieces must not cost more than 9.
    expect(tierTotalPrice(TIERS, 10)).toBeLessThan(tierTotalPrice(TIERS, 9) + 2.38)
  })
})
