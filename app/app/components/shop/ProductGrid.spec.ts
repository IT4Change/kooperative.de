import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import ProductGrid from './ProductGrid.vue'

import type { Product } from '~/data/products'

/** The grid itself is thin: it lays cards out and forwards their add event. */
function product(id: string, name: string): Product {
  return {
    id,
    name,
    price: 1,
    description: '',
    category: 'lebensmittel',
    images: [],
    slug: name.toLowerCase(),
  }
}

describe('ProductGrid', () => {
  it('renders one card per product', async () => {
    const wrapper = await mountSuspended(ProductGrid, {
      props: { products: [product('1', 'Honig'), product('2', 'Brot')] },
    })

    expect(wrapper.text()).toContain('Honig')
    expect(wrapper.text()).toContain('Brot')
  })

  it('says so when nothing matches instead of showing an empty box', async () => {
    const wrapper = await mountSuspended(ProductGrid, { props: { products: [] } })

    expect(wrapper.text()).toContain('Keine Produkte in dieser Kategorie.')
  })

  it('forwards the add event of a card', async () => {
    const wrapper = await mountSuspended(ProductGrid, {
      props: { products: [product('1', 'Honig')] },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('add')?.[0]?.[0]).toMatchObject({ id: '1' })
  })
})
