import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import ProductCard from './ProductCard.vue'

import type { Product, ProductVariant } from '~/data/products'

/**
 * The card in the product grid. It is where the customer picks a size or a
 * quantity before adding to the cart, so the price it shows has to follow that
 * choice — and the emitted event has to carry it, or the cart would silently
 * take the base variant.
 */
function variant(over: Partial<ProductVariant>): ProductVariant {
  return { productId: '1', size: '', price: 0, amount: 1, referenceUnit: 'L', image: '', ...over }
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: '1',
    name: 'Honig',
    price: 11.9,
    description: 'Honig aus der Region',
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

const mount = async (p: Product) => mountSuspended(ProductCard, { props: { product: p } })

describe('a plain product', () => {
  it('shows name, description and price', async () => {
    const wrapper = await mount(product())

    expect(wrapper.text()).toContain('Honig')
    expect(wrapper.text()).toContain('Honig aus der Region')
    expect(wrapper.text()).toContain('11.90')
  })

  it('links to the detail page by id and slug', async () => {
    const wrapper = await mount(product())

    expect(wrapper.find('a').attributes('href')).toBe('/shop/1/honig')
  })

  it('shows the pack size when there is one', async () => {
    const wrapper = await mount(product({ unit: '500 g Glas' }))

    expect(wrapper.text()).toContain('500 g Glas')
  })

  it('offers neither a size picker nor a quantity field', async () => {
    const wrapper = await mount(product())

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('emits a plain add', async () => {
    const wrapper = await mount(product())

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('add')?.[0]).toStrictEqual([product(), undefined])
  })
})

describe('a product with sizes', () => {
  it('offers every size with its unit price', async () => {
    const wrapper = await mount(SIZED)
    const options = wrapper.findAll('option')

    expect(options).toHaveLength(2)
    // 9.52 for half a litre is 19.04 per litre — the comparison the picker exists for.
    expect(options[0].text()).toContain('19.04')
    expect(options[1].text()).toContain('17.85')
  })

  it('starts on the first size', async () => {
    const wrapper = await mount(SIZED)

    expect(wrapper.text()).toContain('9.52')
  })

  it('follows the chosen size', async () => {
    const wrapper = await mount(SIZED)

    await wrapper.get('select').setValue('1')

    expect(wrapper.text()).toContain('17.85')
  })

  it('emits the chosen size index', async () => {
    const wrapper = await mount(SIZED)
    await wrapper.get('select').setValue('1')

    await wrapper.get('button').trigger('click')

    // Without the index the cart would fall back to the base variant.
    expect(wrapper.emitted('add')?.[0]?.[1]).toBe(1)
  })

  it('names the picker per product for screen readers', async () => {
    const wrapper = await mount(SIZED)

    expect(wrapper.get('select').attributes('aria-label')).toBe('Gebindegröße für Olivenöl')
  })
})

describe('a malformed product', () => {
  it('falls back to the base price when a tier product has no tiers', async () => {
    const wrapper = await mount(product({ variantType: 'quantity' }))

    // 11.90 × 1 — no tier list to price against.
    expect(wrapper.text()).toContain('11.90')
  })
})

describe('a product with quantity tiers', () => {
  it('offers a quantity field instead of a size picker', async () => {
    const wrapper = await mount(TIERED)

    expect(wrapper.find('input[type="number"]').exists()).toBe(true)
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('lists the tiers', async () => {
    const wrapper = await mount(TIERED)

    expect(wrapper.text()).toContain('1 Stk.')
    expect(wrapper.text()).toContain('ab 10 Stk.')
  })

  it('shows the total for the entered quantity', async () => {
    const wrapper = await mount(TIERED)

    await wrapper.get('input[type="number"]').setValue(10)

    // Ten pieces at the 1.79 tier — the card shows the line total, not the unit price.
    expect(wrapper.text()).toContain('17.90')
  })

  it('stays on the base tier below the threshold', async () => {
    const wrapper = await mount(TIERED)

    await wrapper.get('input[type="number"]').setValue(9)

    expect(wrapper.text()).toContain('21.42')
  })

  it('emits the tier index and the quantity', async () => {
    const wrapper = await mount(TIERED)
    await wrapper.get('input[type="number"]').setValue(10)

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('add')?.[0]?.slice(1)).toStrictEqual([1, 10])
  })

  it('labels the quantity field', async () => {
    const wrapper = await mount(TIERED)
    const input = wrapper.get('input[type="number"]')

    expect(wrapper.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
  })
})
