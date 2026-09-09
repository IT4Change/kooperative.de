import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import ShopPage from './index.vue'

import type { Product, Category } from '~/data/products'

import { waitFor } from '~~/test/helpers/wait'

/**
 * The shop listing. Everything here hangs off the URL: category, search term
 * and — implicitly — the default category the shop lands on when neither is
 * given. The page also keeps the search and the category from fighting each
 * other, which is the part with the most ways to go wrong.
 */
const CONSENT_KEY = 'kooperative-consent-v1'
const WELCOME_KEY = 'shop-welcome-seen'

localStorage.setItem(CONSENT_KEY, 'true')

const CATEGORIES: Category[] = [
  { slug: 'leer', name: 'Leer', description: '', parentSlug: null },
  { slug: 'buecher', name: 'Bücher', description: '', parentSlug: null },
  { slug: 'buecher/leer', name: 'Bücher leer', description: '', parentSlug: 'buecher' },
  { slug: 'buecher/roman', name: 'Romane', description: '', parentSlug: 'buecher' },
  { slug: 'lebensmittel', name: 'Lebensmittel', description: '', parentSlug: null },
  { slug: 'lebensmittel/oele', name: 'Öle', description: '', parentSlug: 'lebensmittel' },
]

function product(over: Partial<Product> & { id: string; name: string }): Product {
  return {
    price: 10,
    description: '',
    category: 'buecher/roman',
    images: [],
    slug: over.name.toLowerCase(),
    ...over,
  }
}

/** 30 books, so the page size of 24 is exceeded by a known amount. */
const BOOKS: Product[] = Array.from({ length: 30 }, (_, i) =>
  product({
    id: `b${i}`,
    name: `Buch ${String(i).padStart(2, '0')}`,
    // Descending date, so the sorted order is the reverse of the server order.
    dateAdded: `2026-01-${String(30 - i).padStart(2, '0')}`,
  }),
)

const PRODUCTS: Product[] = [
  ...BOOKS,
  product({
    id: 'o1',
    name: 'Olivenöl',
    category: 'lebensmittel/oele',
    description: 'kaltgepresst',
  }),
  product({ id: 'o2', name: 'Sonnenblumenöl', category: 'lebensmittel/oele' }),
  product({ id: 'l1', name: 'Honig', category: 'lebensmittel' }),
]

registerEndpoint('/api/products', () => ({ products: PRODUCTS, categories: CATEGORIES }))
registerEndpoint('/api/auth/me', () => ({ authenticated: false }))

let unmount: (() => void) | null = null

beforeEach(() => {
  localStorage.setItem(WELCOME_KEY, '1')
  clearNuxtData()
})

afterEach(() => {
  // The welcome dialog is teleported to <body>.
  unmount?.()
  unmount = null
})

async function mount(route = '/shop') {
  const wrapper = await mountSuspended(ShopPage, { route })
  await nextTick()
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

const shownNames = (w: Awaited<ReturnType<typeof mount>>) => w.findAll('h3').map((h) => h.text())

const query = () => useRouter().currentRoute.value.query

/**
 * Waits until the URL carries the expected parameters. The page drives itself
 * through router.replace(), which loads the target route's chunk on the way —
 * how many ticks that takes is not something a test can know in advance.
 */
async function urlBecomes(expected: Record<string, string | undefined>) {
  await waitFor(
    () => Object.entries(expected).every(([key, value]) => query()[key] === value),
    `URL ${JSON.stringify(expected)}, last seen ${JSON.stringify(query())}`,
  )
  await nextTick()
}

/** Clicks a button of the category bar by its visible label. */
async function clickCategory(w: Awaited<ReturnType<typeof mount>>, label: string) {
  const button = w.findAll('button').find((b) => b.text().replace(/\s+/g, ' ').startsWith(label))
  await button!.trigger('click')
}

describe('choosing a category', () => {
  it('lands on the first category that has products', async () => {
    const wrapper = await mount('/shop')

    // 'leer' comes first in the list but has none, and neither has 'buecher/leer'.
    expect(shownNames(wrapper)[0]).toMatch(/^Buch /)
    expect(shownNames(wrapper)).toHaveLength(24)
  })

  it('follows the category in the URL', async () => {
    const wrapper = await mount('/shop?kategorie=lebensmittel')

    expect(shownNames(wrapper)).toStrictEqual(['Olivenöl', 'Sonnenblumenöl', 'Honig'])
  })

  it('shows a subcategory on its own', async () => {
    const wrapper = await mount('/shop?kategorie=lebensmittel/oele')

    expect(shownNames(wrapper)).toStrictEqual(['Olivenöl', 'Sonnenblumenöl'])
  })

  it('treats "alle" as an explicit choice, not as an absent one', async () => {
    const wrapper = await mount('/shop?kategorie=alle')

    // 33 products, capped at the page size.
    expect(shownNames(wrapper)).toHaveLength(24)
    expect(wrapper.text()).toContain('24 von 33 Produkten angezeigt')
  })

  it('falls back to the default for a category that does not exist', async () => {
    const wrapper = await mount('/shop?kategorie=gibtesnicht')

    expect(shownNames(wrapper)[0]).toMatch(/^Buch /)
  })

  it('writes the chosen category into the URL', async () => {
    const wrapper = await mount('/shop')

    await clickCategory(wrapper, 'Lebensmittel')
    await urlBecomes({ kategorie: 'lebensmittel' })

    expect(query().kategorie).toBe('lebensmittel')
  })

  it('writes "alle" when the filter is cleared', async () => {
    const wrapper = await mount('/shop?kategorie=lebensmittel')

    await clickCategory(wrapper, 'Alle')
    await urlBecomes({ kategorie: 'alle' })

    expect(query().kategorie).toBe('alle')
  })
})

describe('search', () => {
  it('matches the product name', async () => {
    const wrapper = await mount('/shop')

    await wrapper.get('input[type="search"]').setValue('Olivenöl')
    await urlBecomes({ q: 'Olivenöl' })

    expect(shownNames(wrapper)).toStrictEqual(['Olivenöl'])
  })

  it('matches the description', async () => {
    const wrapper = await mount('/shop')

    await wrapper.get('input[type="search"]').setValue('kaltgepresst')
    await urlBecomes({ q: 'kaltgepresst' })

    expect(shownNames(wrapper)).toStrictEqual(['Olivenöl'])
  })

  it('matches the category name', async () => {
    const wrapper = await mount('/shop')

    await wrapper.get('input[type="search"]').setValue('romane')
    await urlBecomes({ q: 'romane' })

    expect(shownNames(wrapper)).toHaveLength(24)
  })

  it('searches the whole range, not the current category', async () => {
    // Scoping the search to the preselected category would report "nothing
    // found" while the match sits one click away.
    const wrapper = await mount('/shop?kategorie=buecher')

    await wrapper.get('input[type="search"]').setValue('Honig')
    await urlBecomes({ q: 'Honig' })

    expect(query().kategorie).toBe('alle')
    expect(shownNames(wrapper)).toStrictEqual(['Honig'])
  })

  it('restores the category the customer had chosen', async () => {
    const wrapper = await mount('/shop?kategorie=lebensmittel')
    const input = wrapper.get('input[type="search"]')
    await input.setValue('Honig')
    await urlBecomes({ q: 'Honig' })

    await input.setValue('')
    await urlBecomes({ q: undefined })

    expect(query().kategorie).toBe('lebensmittel')
    expect(shownNames(wrapper)).toStrictEqual(['Olivenöl', 'Sonnenblumenöl', 'Honig'])
  })

  it('restores the default when there was no category', async () => {
    const wrapper = await mount('/shop')
    const input = wrapper.get('input[type="search"]')
    await input.setValue('Honig')
    await urlBecomes({ q: 'Honig' })

    await input.setValue('')
    await urlBecomes({ q: undefined, kategorie: undefined })

    expect(query().kategorie).toBeUndefined()
    expect(shownNames(wrapper)[0]).toMatch(/^Buch /)
  })

  it('picks the search term up from the URL', async () => {
    const wrapper = await mount('/shop?q=Honig&kategorie=alle')

    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('Honig')
    expect(shownNames(wrapper)).toStrictEqual(['Honig'])
  })

  it('follows the term back and forward through the history', async () => {
    const wrapper = await mount('/shop?kategorie=alle')

    await useRouter().replace({ path: '/shop', query: { kategorie: 'alle', q: 'Honig' } })
    await nextTick()

    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('Honig')
  })

  it('says so when nothing matches', async () => {
    const wrapper = await mount('/shop')

    await wrapper.get('input[type="search"]').setValue('Traktor')
    await urlBecomes({ q: 'Traktor' })

    expect(wrapper.text()).toContain('Keine Produkte gefunden.')
  })
})

describe('category counts', () => {
  it('counts subcategories towards their parent', async () => {
    const wrapper = await mount('/shop')
    const counts = wrapper.findAllComponents({ name: 'ShopCategoryFilter' })[0].props('counts')

    expect(counts).toMatchObject({
      buecher: 30,
      'buecher/roman': 30,
      lebensmittel: 3,
      'lebensmittel/oele': 2,
    })
    expect(counts).not.toHaveProperty('leer')
  })

  it('follows the search', async () => {
    const wrapper = await mount('/shop')

    await wrapper.get('input[type="search"]').setValue('Honig')
    await urlBecomes({ q: 'Honig' })

    expect(
      wrapper.findAllComponents({ name: 'ShopCategoryFilter' })[0].props('counts'),
    ).toStrictEqual({ lebensmittel: 1 })
  })
})

describe('sorting', () => {
  it('puts the newest book first', async () => {
    // The books arrive in ascending date order, so the server order alone would
    // show the oldest first.
    const wrapper = await mount('/shop?kategorie=buecher')

    expect(shownNames(wrapper)[0]).toBe('Buch 00')
    expect(shownNames(wrapper)[1]).toBe('Buch 01')
  })

  it('leaves other categories in the order the server sent', async () => {
    const wrapper = await mount('/shop?kategorie=lebensmittel')

    expect(shownNames(wrapper)).toStrictEqual(['Olivenöl', 'Sonnenblumenöl', 'Honig'])
  })
})

describe('paging', () => {
  it('shows the first page and offers more', async () => {
    const wrapper = await mount('/shop?kategorie=alle')

    expect(shownNames(wrapper)).toHaveLength(24)
    expect(wrapper.text()).toContain('Mehr anzeigen')
  })

  it('appends the next page', async () => {
    const wrapper = await mount('/shop?kategorie=alle')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Mehr anzeigen')!
      .trigger('click')

    expect(shownNames(wrapper)).toHaveLength(33)
    expect(wrapper.text()).not.toContain('Mehr anzeigen')
  })

  it('announces the count for screen readers', async () => {
    const wrapper = await mount('/shop?kategorie=alle')

    expect(wrapper.get('[role="status"]').text()).toBe('24 von 33 Produkten angezeigt')
  })

  it('goes back to the first page when the filter narrows', async () => {
    const wrapper = await mount('/shop?kategorie=alle')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Mehr anzeigen')!
      .trigger('click')

    await clickCategory(wrapper, 'Bücher')
    await urlBecomes({ kategorie: 'buecher' })

    // Leaving the count where it was would dump 33 books on the next category.
    expect(shownNames(wrapper)).toHaveLength(24)
  })
})

describe('the welcome dialog', () => {
  it('greets a first-time visitor', async () => {
    localStorage.removeItem(WELCOME_KEY)

    await mount('/shop')
    await nextTick()

    expect(document.body.textContent).toContain('So funktioniert die Bestellung')
  })

  it('stays away on the next visit', async () => {
    await mount('/shop')

    expect(document.body.textContent).not.toContain('So funktioniert die Bestellung')
  })

  it('remembers that it was read', async () => {
    localStorage.removeItem(WELCOME_KEY)
    await mount('/shop')
    await nextTick()

    const button = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Verstanden',
    )
    button?.click()
    await nextTick()

    expect(document.body.textContent).not.toContain('So funktioniert die Bestellung')
    expect(localStorage.getItem(WELCOME_KEY)).toBe('1')
  })

  it('can be called up again from the question mark', async () => {
    const wrapper = await mount('/shop')

    await wrapper.get('button[title="Hilfe"]').trigger('click')
    await nextTick()

    expect(document.body.textContent).toContain('So funktioniert die Bestellung')
  })
})

describe('adding to the cart', () => {
  it('passes the product on from the grid', async () => {
    const wrapper = await mount('/shop?kategorie=lebensmittel')
    const { clearCart, items, closeCart } = useCart()
    clearCart()

    await wrapper.findAllComponents({ name: 'ShopProductGrid' })[0].vm.$emit('add', PRODUCTS[31], 0)

    expect(items.value[0]).toMatchObject({ product: { id: 'o2' }, variantIndex: 0 })
    clearCart()
    closeCart()
  })
})
