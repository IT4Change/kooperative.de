import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import CustomerList from './index.vue'

import { waitFor } from '~~/test/helpers/wait'

/** Read-only customer list: search and paging, nothing else. */
interface Row {
  id: number
  name: string
  email: string
  telephone: string
  city: string
}

const ROWS: Row[] = [
  {
    id: 88,
    name: 'Erika Muster',
    email: 'erika@example.org',
    telephone: '0711 123',
    city: 'Dürnau',
  },
  { id: 89, name: '', email: 'ohne@example.org', telephone: '', city: '' },
]

let rows: Row[] = []
let total = 0
let fail = false
let failMessage: string | undefined = 'kaputt'
const seen: Record<string, string>[] = []

const queryOf = (path: string) => Object.fromEntries(new URLSearchParams(path.split('?')[1] ?? ''))

registerEndpoint('/admin/api/customers', (event) => {
  seen.push(queryOf(event.path))
  if (fail) throw createError({ statusCode: 500, statusMessage: failMessage })
  return { total, page: 1, limit: 50, customers: rows }
})

let unmount: (() => void) | null = null

beforeEach(() => {
  rows = ROWS
  total = 2
  fail = false
  failMessage = 'kaputt'
  seen.length = 0
  clearNuxtData()
})

afterEach(() => {
  unmount?.()
  unmount = null
})

async function mount(route = '/admin/customers') {
  const wrapper = await mountSuspended(CustomerList, { route })
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
  it('shows a customer with a mailto link', async () => {
    const wrapper = await mount()
    const cells = wrapper
      .findAll('tbody tr')[0]
      .findAll('td')
      .map((c) => c.text())

    expect(cells).toStrictEqual(['88', 'Erika Muster', 'erika@example.org', '0711 123', 'Dürnau'])
    expect(wrapper.get('a[href="mailto:erika@example.org"]').exists()).toBe(true)
  })

  it('marks the fields the legacy data left empty', async () => {
    const wrapper = await mount()
    const cells = wrapper
      .findAll('tbody tr')[1]
      .findAll('td')
      .map((c) => c.text())

    expect(cells).toStrictEqual(['89', '—', 'ohne@example.org', '–', '–'])
  })

  it('says so when nothing matches', async () => {
    rows = []
    total = 0

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Keine Kunden gefunden.')
  })

  it('reports a failing query', async () => {
    fail = true

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Fehler beim Laden')
    expect(wrapper.text()).toContain('kaputt')
  })

  it('falls back to the raw error when the server sends no message', async () => {
    fail = true
    failMessage = undefined

    const wrapper = await mount()

    expect(wrapper.text()).toMatch(/Fehler beim Laden: .+/)
  })

  it('counts the whole result', async () => {
    total = 4321

    const wrapper = await mount()

    expect(wrapper.text()).toContain('4.321 Kunden')
  })
})

describe('search', () => {
  it('carries the term into the URL', async () => {
    const wrapper = await mount()
    await wrapper.get('input[type="search"]').setValue('Muster')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Suchen')!
      .trigger('click')
    await urlBecomes({ q: 'Muster' })

    expect(query().q).toBe('Muster')
  })

  it('searches on Enter as well', async () => {
    const wrapper = await mount()
    const input = wrapper.get('input[type="search"]')
    await input.setValue('88')

    await input.trigger('keyup.enter')
    await urlBecomes({ q: '88' })

    expect(query().q).toBe('88')
  })

  it('clears the term out of the URL again', async () => {
    const wrapper = await mount('/admin/customers?q=Muster')
    await wrapper.get('input[type="search"]').setValue('')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Suchen')!
      .trigger('click')
    await urlBecomes({ q: undefined })

    expect(query()).toStrictEqual({})
  })

  it('passes the term on to the API', async () => {
    await mount('/admin/customers?q=Muster')

    expect(seen.at(-1)?.q).toBe('Muster')
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
    const wrapper = await mount('/admin/customers?q=Muster')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Weiter'))!
      .trigger('click')
    await urlBecomes({ page: '2' })

    expect(query()).toStrictEqual({ q: 'Muster', page: '2' })
  })

  it('leaves the first page out of the URL', async () => {
    total = 120
    const wrapper = await mount('/admin/customers?page=2')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Zurück'))!
      .trigger('click')
    await urlBecomes({ page: undefined })

    expect(query()).toStrictEqual({})
  })

  it('takes a garbled page number for the first one', async () => {
    total = 120

    const wrapper = await mount('/admin/customers?page=quatsch')

    expect(wrapper.text()).toContain('Seite 1 / 3')
  })

  it('cannot go past either end', async () => {
    total = 120

    const first = await mount()
    expect(first.get('button[disabled]').text()).toContain('Zurück')
    first.unmount()

    const last = await mount('/admin/customers?page=3')
    expect(last.findAll('button[disabled]').at(-1)?.text()).toContain('Weiter')
  })
})
