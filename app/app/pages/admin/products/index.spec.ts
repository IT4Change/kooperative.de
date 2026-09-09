import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import ProductList from './index.vue'

import { waitFor } from '~~/test/helpers/wait'

/** Read-only product list: search, an "active only" switch and paging. */
interface Row {
  id: number
  model: string
  name: string
  price: number | null
  active: boolean
  ordered: number
  quantity: number
}

const ROWS: Row[] = [
  { id: 12, model: 'ART-1', name: 'Honig', price: 11.9, active: true, ordered: 1234, quantity: 5 },
  { id: 13, model: '', name: 'Karte', price: null, active: false, ordered: 0, quantity: 0 },
]

let rows: Row[] = []
let total = 0
let fail = false
const seen: Record<string, string>[] = []

const queryOf = (path: string) => Object.fromEntries(new URLSearchParams(path.split('?')[1] ?? ''))

registerEndpoint('/admin/api/products', (event) => {
  seen.push(queryOf(event.path))
  if (fail) throw createError({ statusCode: 500, statusMessage: 'kaputt' })
  return { total, page: 1, limit: 50, products: rows }
})

let unmount: (() => void) | null = null

beforeEach(() => {
  rows = ROWS
  total = 2
  fail = false
  seen.length = 0
  clearNuxtData()
})

afterEach(() => {
  unmount?.()
  unmount = null
})

async function mount(route = '/admin/products') {
  const wrapper = await mountSuspended(ProductList, { route })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

const query = () => useRouter().currentRoute.value.query

/**
 * Waits until the URL carries the expected parameters. A router push loads the
 * target route's chunk on the way, so how many ticks it needs is not something
 * a test can know in advance.
 */
async function urlBecomes(expected: Record<string, string | undefined>) {
  await waitFor(
    () => Object.entries(expected).every(([key, value]) => query()[key] === value),
    `URL ${JSON.stringify(expected)}, last seen ${JSON.stringify(query())}`,
  )
  await nextTick()
}

describe('the table', () => {
  it('shows a product with price, sales and state', async () => {
    const wrapper = await mount()
    const cells = wrapper
      .findAll('tbody tr')[0]
      .findAll('td')
      .map((c) => c.text())

    expect(cells).toStrictEqual(['12', 'ART-1', 'Honig', '11,90 €', '1.234', 'aktiv'])
  })

  it('marks what the legacy shop left blank', async () => {
    const wrapper = await mount()
    const cells = wrapper
      .findAll('tbody tr')[1]
      .findAll('td')
      .map((c) => c.text())

    // A missing price is not a price of zero.
    expect(cells).toStrictEqual(['13', '–', 'Karte', '–', '0', 'inaktiv'])
  })

  it('says so when nothing matches', async () => {
    rows = []
    total = 0

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Keine Produkte gefunden.')
  })

  it('reports a failing query', async () => {
    fail = true

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Fehler beim Laden')
    expect(wrapper.text()).toContain('kaputt')
  })

  it('counts the whole result', async () => {
    total = 1234

    const wrapper = await mount()

    expect(wrapper.text()).toContain('1.234 Produkte')
  })
})

describe('filtering', () => {
  it('carries the search term into the URL', async () => {
    const wrapper = await mount()
    await wrapper.get('input[type="search"]').setValue('Honig')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Suchen')!
      .trigger('click')
    await urlBecomes({ q: 'Honig' })

    expect(query().q).toBe('Honig')
  })

  it('searches on Enter as well', async () => {
    const wrapper = await mount()
    const input = wrapper.get('input[type="search"]')
    await input.setValue('ART-1')

    await input.trigger('keyup.enter')
    await urlBecomes({ q: 'ART-1' })

    expect(query().q).toBe('ART-1')
  })

  it('switches to active products only', async () => {
    const wrapper = await mount()

    await wrapper.get('input[type="checkbox"]').trigger('change')
    await urlBecomes({ active: '1' })

    expect(query().active).toBe('1')
  })

  it('switches back', async () => {
    const wrapper = await mount('/admin/products?active=1')
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)

    await wrapper.get('input[type="checkbox"]').trigger('change')
    await urlBecomes({ active: undefined })

    expect(query().active).toBeUndefined()
  })

  it('passes both filters on to the API', async () => {
    await mount('/admin/products?q=Honig&active=1')

    expect(seen.at(-1)).toMatchObject({ q: 'Honig', active: '1' })
  })
})

describe('paging', () => {
  it('stays hidden for a single page', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Seite')
  })

  it('appears once the result spills over', async () => {
    total = 120

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Seite 1 / 3')
  })

  it('keeps the search term while paging', async () => {
    total = 120
    const wrapper = await mount('/admin/products?q=Honig')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Weiter'))!
      .trigger('click')
    await urlBecomes({ page: '2' })

    // Losing the term would silently page through the whole catalogue.
    expect(query()).toStrictEqual({ q: 'Honig', page: '2' })
  })

  it('leaves the first page out of the URL', async () => {
    total = 120
    const wrapper = await mount('/admin/products?page=2')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Zurück'))!
      .trigger('click')
    await urlBecomes({ page: undefined })

    expect(query().page).toBeUndefined()
  })

  it('cannot go past either end', async () => {
    total = 120

    const first = await mount()
    expect(first.get('button[disabled]').text()).toContain('Zurück')
    first.unmount()

    const last = await mount('/admin/products?page=3')
    expect(last.findAll('button[disabled]').at(-1)?.text()).toContain('Weiter')
  })
})
