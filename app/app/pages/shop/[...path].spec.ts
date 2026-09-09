import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { config } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'

import ProductPage from './[...path].vue'

import type { Product } from '~/data/products'

import { waitFor } from '~~/test/helpers/wait'

/**
 * The product detail page. Besides the price arithmetic it does two things no
 * component does: it resolves /shop/{id} and /shop/{slug} to the canonical URL,
 * and it bumps the view counter of the legacy shop.
 */
const CONSENT_KEY = 'kooperative-consent-v1'

// Consent has to be on record before the first useConsent() call, or adding to
// the cart would open the banner instead.
localStorage.setItem(CONSENT_KEY, 'true')

const OLIVENOEL: Product = {
  id: '3',
  name: 'Olivenöl',
  slug: 'olivenoel',
  price: 9.52,
  description: 'Kaltgepresst',
  category: 'lebensmittel',
  images: ['/img/oel.jpg'],
  model: 'OEL-1',
  content: '0,5 Liter',
  details: 'Aus Kreta',
  metaTitle: 'Olivenöl kaufen',
  metaDescription: 'Kaltgepresstes Olivenöl',
  metaKeywords: 'olivenöl, bio',
  variants: [
    {
      productId: '3',
      size: '0,5 L',
      price: 9.52,
      amount: 0.5,
      referenceUnit: 'L',
      image: '/img/oel-05.jpg',
    },
    {
      productId: '3',
      size: '1 L',
      price: 17.85,
      amount: 1,
      referenceUnit: 'L',
      image: '/img/oel-1.jpg',
    },
  ],
}

const KARTE: Product = {
  id: '5',
  name: 'Karte',
  slug: 'karte',
  price: 2.38,
  description: '',
  category: 'papeterie',
  images: ['/img/karte.jpg'],
  variantType: 'quantity',
  variants: [
    { productId: '5', size: '1 Stk.', price: 2.38, amount: 1, referenceUnit: 'Stk', image: '' },
    {
      productId: '5',
      size: 'ab 10 Stk.',
      price: 1.79,
      amount: 1,
      referenceUnit: 'Stk',
      image: '',
      minQty: 10,
    },
  ],
}

const HONIG: Product = {
  id: '1',
  name: 'Honig',
  slug: 'honig',
  price: 11.9,
  description: 'Aus der Region',
  category: 'lebensmittel',
  images: ['/img/honig.jpg'],
  unit: '500 g Glas',
}

const views: string[] = []

registerEndpoint('/api/products/3', () => ({ product: OLIVENOEL, categoryName: 'Öle' }))
registerEndpoint('/api/products/5', () => ({ product: KARTE, categoryName: 'Papeterie' }))
registerEndpoint('/api/products/1', () => ({ product: HONIG, categoryName: 'Lebensmittel' }))
registerEndpoint('/api/products/honig', () => ({ product: HONIG, categoryName: 'Lebensmittel' }))
registerEndpoint('/api/products/404', () => ({}))
// The page also hosts the cart panel, which asks who is logged in.
registerEndpoint('/api/auth/me', () => ({ authenticated: false }))
registerEndpoint('/api/products', () => ({ products: [] }))
for (const id of ['1', '3', '5']) {
  registerEndpoint(`/api/products/${id}/view`, {
    // Uppercase on purpose: the registry compares against event.method verbatim.
    method: 'POST',
    handler: () => {
      views.push(id)
      return { ok: true }
    },
  })
}

beforeEach(() => {
  views.length = 0
  clearNuxtData()
})

const mount = async (route: string) => mountSuspended(ProductPage, { route })

/** Lets a pending render or fetch finish; used where nothing better exists. */
const settle = async () => new Promise((resolve) => setTimeout(resolve, 20))

describe('resolving the URL', () => {
  it('shows the product addressed by id and slug', async () => {
    const wrapper = await mount('/shop/1/honig')

    expect(wrapper.get('h1').text()).toBe('Honig')
    expect(wrapper.text()).toContain('Lebensmittel')
  })

  it('rewrites a bare id to the canonical URL', async () => {
    await mount('/shop/1')

    // Two URLs for one product would split the page's search ranking.
    expect(useRouter().currentRoute.value.path).toBe('/shop/1/honig')
  })

  it('accepts the slug alone as well', async () => {
    await mount('/shop/honig')

    expect(useRouter().currentRoute.value.path).toBe('/shop/1/honig')
  })

  it('sends an unknown product back to the shop', async () => {
    // The page aborts its own setup here. The global handlers of test/setup.ts
    // turn every Vue error into a test failure, and mountSuspended still lets
    // the render effect run once against the half-built instance — so they are
    // muted for the length of this one mount.
    const { errorHandler, warnHandler } = config.global.config
    config.global.config.errorHandler = () => {}
    config.global.config.warnHandler = () => {}

    await expect(mount('/shop/404')).rejects.toThrow('Product not found')
    await settle()

    config.global.config.errorHandler = errorHandler
    config.global.config.warnHandler = warnHandler
  })
})

describe('the product itself', () => {
  it('shows article number, content and details', async () => {
    const wrapper = await mount('/shop/3/olivenoel')
    const text = wrapper.text()

    expect(text).toContain('Art.-Nr. OEL-1')
    expect(text).toContain('0,5 Liter')
    expect(text).toContain('Aus Kreta')
    expect(text).toContain('Kaltgepresst')
  })

  it('leaves out what the product does not carry', async () => {
    const wrapper = await mount('/shop/1/honig')

    expect(wrapper.text()).not.toContain('Art.-Nr.')
  })

  it('shows the pack size of a product without variants', async () => {
    const wrapper = await mount('/shop/1/honig')

    expect(wrapper.text()).toContain('/ 500 g Glas')
    expect(wrapper.text()).toContain('11.90')
  })

  it('counts the view once', async () => {
    await mount('/shop/1/honig')
    await waitFor(() => views.length > 0, 'the view counter POST')

    expect(views).toStrictEqual(['1'])
  })
})

describe('size variants', () => {
  it('offers every size with its unit price', async () => {
    const wrapper = await mount('/shop/3/olivenoel')
    const options = wrapper.findAll('option').map((o) => o.text().replace(/\s+/g, ' '))

    expect(options).toStrictEqual(['0,5 L · 19.04 €/L', '1 L · 17.85 €/L'])
  })

  it('starts on the first size', async () => {
    const wrapper = await mount('/shop/3/olivenoel')

    expect(wrapper.text()).toContain('9.52')
    expect(wrapper.text()).toContain('19.04 €/L')
  })

  it('follows the chosen size, down to the picture', async () => {
    const wrapper = await mount('/shop/3/olivenoel')

    await wrapper.get('select').setValue('1')

    expect(wrapper.text()).toContain('17.85')
    expect(wrapper.html()).toContain('/img/oel-1.jpg')
  })

  it('labels the picker', async () => {
    const wrapper = await mount('/shop/3/olivenoel')
    const id = wrapper.get('select').attributes('id')

    expect(wrapper.get(`label[for="${id}"]`).text()).toBe('Gebindegröße')
  })
})

describe('quantity tiers', () => {
  it('lists the tiers instead of a picker', async () => {
    const wrapper = await mount('/shop/5/karte')

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).toContain('1 Stk.: 2.38 €/Stk')
    expect(wrapper.text()).toContain('ab 10 Stk.: 1.79 €/Stk')
  })

  it('shows the total for the entered quantity', async () => {
    const wrapper = await mount('/shop/5/karte')

    await wrapper.get('input[type="number"]').setValue(10)

    expect(wrapper.text()).toContain('17.90')
    expect(wrapper.text()).toContain('10 × 1.79 €')
  })

  it('marks the tier that applies', async () => {
    const wrapper = await mount('/shop/5/karte')
    await wrapper.get('input[type="number"]').setValue(10)

    const marked = wrapper.findAll('.text-\\[\\#00af8c\\].font-medium').map((d) => d.text())

    expect(marked).toContain('ab 10 Stk.: 1.79 €/Stk')
  })

  it('stays on the base tier below the threshold', async () => {
    const wrapper = await mount('/shop/5/karte')

    await wrapper.get('input[type="number"]').setValue(9)

    expect(wrapper.text()).toContain('21.42')
  })
})

describe('adding to the cart', () => {
  const add = async (route: string) => {
    const wrapper = await mount(route)
    const { clearCart, items } = useCart()
    clearCart()
    return { wrapper, items }
  }

  it('adds a plain product', async () => {
    const { wrapper, items } = await add('/shop/1/honig')

    await wrapper.get('button').trigger('click')

    expect(items.value).toHaveLength(1)
    expect(items.value[0]).toMatchObject({ product: { id: '1' }, quantity: 1 })
    expect(items.value[0].variantIndex).toBeUndefined()
  })

  it('carries the chosen size along', async () => {
    const { wrapper, items } = await add('/shop/3/olivenoel')
    await wrapper.get('select').setValue('1')

    await wrapper.get('button').trigger('click')

    // Without the index the cart would silently price the small bottle.
    expect(items.value[0]).toMatchObject({ variantIndex: 1, quantity: 1 })
  })

  it('carries quantity and tier along', async () => {
    const { wrapper, items } = await add('/shop/5/karte')
    await wrapper.get('input[type="number"]').setValue(12)

    await wrapper.get('button').trigger('click')

    expect(items.value[0]).toMatchObject({ product: { id: '5' }, quantity: 12 })
  })

  it('opens the cart so the customer sees what happened', async () => {
    const { wrapper } = await add('/shop/1/honig')
    const { isOpen } = useCart()

    await wrapper.get('button').trigger('click')

    expect(isOpen.value).toBe(true)
    useCart().closeCart()
  })
})

describe('metadata', () => {
  it('prefers the maintained meta title', async () => {
    await mount('/shop/3/olivenoel')
    await waitFor(() => document.title.startsWith('Olivenöl'), 'the page title')

    expect(document.title).toBe('Olivenöl kaufen – Kooperative Dürnau')
  })

  it('falls back to the product name', async () => {
    await mount('/shop/1/honig')
    await waitFor(() => document.title.startsWith('Honig'), 'the page title')

    expect(document.title).toBe('Honig – Kooperative Dürnau')
  })
})
