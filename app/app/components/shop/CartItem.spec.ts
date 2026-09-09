import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import CartItem from './CartItem.vue'

import type { CartItem as Item, Product, ProductVariant } from '~/data/products'

/**
 * One line of the cart. Besides showing quantity and price it carries the two
 * upsell hints — "a bigger pack is cheaper per litre" and "n more and the next
 * tier applies" — which are the only place in the shop where that arithmetic is
 * shown to the customer.
 */
function variant(over: Partial<ProductVariant>): ProductVariant {
  return { productId: '1', size: '', price: 0, amount: 1, referenceUnit: 'L', image: '', ...over }
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: '1',
    name: 'Honig',
    price: 11.9,
    description: '',
    category: 'lebensmittel',
    images: [],
    slug: 'honig',
    ...over,
  }
}

const SIZED = product({
  id: '3',
  name: 'Olivenöl',
  price: 9.52,
  variants: [
    variant({ size: '0,5 L', price: 9.52, amount: 0.5 }),
    variant({ size: '1 L', price: 17.85, amount: 1 }),
  ],
})

const TIERED = product({
  id: '5',
  name: 'Karte',
  price: 2.38,
  variantType: 'quantity',
  variants: [
    variant({ size: '1 Stk.', price: 2.38, referenceUnit: 'Stk', minQty: 1 }),
    variant({ size: 'ab 10 Stk.', price: 1.79, referenceUnit: 'Stk', minQty: 10 }),
  ],
})

const mount = async (item: Item) => mountSuspended(CartItem, { props: { item } })

describe('display', () => {
  it('shows name, unit price and line total', async () => {
    const wrapper = await mount({ product: product(), quantity: 2 })

    expect(wrapper.text()).toContain('Honig')
    expect(wrapper.text()).toContain('11.90')
    // 2 × 11.90
    expect(wrapper.text()).toContain('23.80')
  })

  it('names the chosen size next to the product', async () => {
    const wrapper = await mount({ product: SIZED, quantity: 1, variantIndex: 1 })

    expect(wrapper.text()).toContain('Olivenöl')
    expect(wrapper.text()).toContain('1 L')
    expect(wrapper.text()).toContain('17.85')
  })

  it('prices a quantity-tier item at the applicable tier', async () => {
    const wrapper = await mount({ product: TIERED, quantity: 10 })

    // 1.79 per piece, not 2.38
    expect(wrapper.text()).toContain('1.79')
    expect(wrapper.text()).toContain('Staffel')
  })
})

describe('changing the line', () => {
  it('emits an increase', async () => {
    const wrapper = await mount({ product: product(), quantity: 2 })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('update')?.[0]).toStrictEqual(['1', 3, undefined])
  })

  it('emits a decrease', async () => {
    const wrapper = await mount({ product: product(), quantity: 2 })

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('update')?.[0]).toStrictEqual(['1', 1, undefined])
  })

  it('keeps the variant index when changing the quantity', async () => {
    const wrapper = await mount({ product: SIZED, quantity: 1, variantIndex: 1 })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('update')?.[0]).toStrictEqual(['3', 2, 1])
  })

  it('emits a removal', async () => {
    const wrapper = await mount({ product: SIZED, quantity: 1, variantIndex: 0 })

    await wrapper.get('[aria-label="Entfernen"]').trigger('click')

    expect(wrapper.emitted('remove')?.[0]).toStrictEqual(['3', 0])
  })

  it('takes a typed quantity for a tier product', async () => {
    const wrapper = await mount({ product: TIERED, quantity: 1 })
    const input = wrapper.get('input[type="number"]')

    await input.setValue('25')
    await input.trigger('change')

    expect(wrapper.emitted('update')?.[0]).toStrictEqual(['5', 25, undefined])
  })

  it.each([
    ['0', 1],
    ['-5', 1],
    ['abc', 1],
  ])('clamps the typed quantity %j to %i', async (typed, expected) => {
    const wrapper = await mount({ product: TIERED, quantity: 5 })
    const input = wrapper.get('input[type="number"]')

    await input.setValue(typed)
    await input.trigger('change')

    // A zero would silently remove the line; the minus button is the way to do that.
    expect(wrapper.emitted('update')?.[0]).toStrictEqual(['5', expected, undefined])
  })
})

describe('savings hint', () => {
  it('points at the cheaper pack size', async () => {
    const wrapper = await mount({ product: SIZED, quantity: 1, variantIndex: 0 })

    // 0,5 L costs 19.04 €/L, 1 L costs 17.85 €/L — 1.19 € per litre less.
    expect(wrapper.text()).toContain('Tipp')
    expect(wrapper.text()).toContain('1 L')
    expect(wrapper.text()).toContain('1.19')
  })

  it('stays quiet when the cheapest size is already chosen', async () => {
    const wrapper = await mount({ product: SIZED, quantity: 1, variantIndex: 1 })

    expect(wrapper.text()).not.toContain('Tipp')
  })

  it('stays quiet for a product without sizes', async () => {
    const wrapper = await mount({ product: product(), quantity: 1 })

    expect(wrapper.text()).not.toContain('Tipp')
  })

  it('stays quiet for a quantity-tier product', async () => {
    // Tiers have their own hint; two competing suggestions would be noise.
    const wrapper = await mount({ product: TIERED, quantity: 1 })

    expect(wrapper.text()).not.toContain('Tipp')
  })
})

describe('next-tier hint', () => {
  it('says how many more reach the next tier', async () => {
    const wrapper = await mount({ product: TIERED, quantity: 8 })

    expect(wrapper.text()).toContain('2')
  })

  it('stays quiet once the last tier is reached', async () => {
    const wrapper = await mount({ product: TIERED, quantity: 10 })
    const text = wrapper.text()

    expect(text).toContain('Staffel')
    expect(text).not.toMatch(/noch \d+/)
  })

  it('stays quiet for a product without tiers', async () => {
    const wrapper = await mount({ product: SIZED, quantity: 1, variantIndex: 0 })

    expect(wrapper.text()).not.toMatch(/noch \d+/)
  })
})
