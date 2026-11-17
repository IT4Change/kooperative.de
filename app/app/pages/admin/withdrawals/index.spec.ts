import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import WithdrawalList from './index.vue'

import { waitFor } from '~~/test/helpers/wait'

/**
 * Withdrawals from both shops. The operator must see at a glance which are
 * linked to an order and which still need assigning by hand.
 */
const ROWS = [
  {
    id: 2,
    name: 'Erika Muster',
    email: 'erika@example.org',
    orderRef: '55',
    scope: 'partial',
    items: '1× Honig',
    message: 'Glas kaputt',
    ordersId: 55,
    createdAt: '2026-11-17T13:03:00Z',
  },
  {
    id: 1,
    name: 'Max Muster',
    email: 'max@example.org',
    orderRef: 'vom 3. November',
    scope: 'all',
    items: null,
    message: null,
    ordersId: null,
    createdAt: '2026-11-16T08:00:00Z',
  },
]

let rows = ROWS
let total = 2
let fail = false
let failMessage: string | undefined = 'kaputt'
const seen: string[] = []

registerEndpoint('/admin/api/withdrawals', (event) => {
  seen.push(event.path)
  if (fail) throw createError({ statusCode: 500, statusMessage: failMessage })
  return { total, page: 1, limit: 50, withdrawals: rows }
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

async function mount(route = '/admin/withdrawals') {
  const wrapper = await mountSuspended(WithdrawalList, { route })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

describe('the list', () => {
  it('links a matched withdrawal to its order', async () => {
    const wrapper = await mount()
    const row = wrapper.findAll('tbody tr')[0]

    expect(row.get('a[href="/admin/orders/55"]').text()).toBe('#55')
    expect(row.text()).toContain('einzelne Artikel')
    expect(row.text()).toContain('1× Honig')
    expect(row.text()).toContain('Glas kaputt')
  })

  it('flags one that still needs assigning by hand', async () => {
    const wrapper = await mount()
    const row = wrapper.findAll('tbody tr')[1]

    expect(row.text()).toContain('„vom 3. November“ – nicht zugeordnet')
    expect(row.text()).toContain('gesamte Bestellung')
    expect(row.get('a[href="mailto:max@example.org"]').exists()).toBe(true)
  })

  it('says so when there is none', async () => {
    rows = []
    total = 0

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Keine Widerrufe.')
  })

  it('reports a failing query', async () => {
    fail = true

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Fehler beim Laden: kaputt')
  })

  it('falls back to the raw error when the server sends no message', async () => {
    fail = true
    failMessage = undefined

    const wrapper = await mount()

    expect(wrapper.text()).toMatch(/Fehler beim Laden: .+/)
  })
})

describe('paging', () => {
  it('pages through a long list', async () => {
    total = 120
    const wrapper = await mount()
    expect(wrapper.text()).toContain('Seite 1 / 3')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Weiter'))!
      .trigger('click')

    await waitFor(() => useRouter().currentRoute.value.query.page === '2', 'URL carries page=2')
    await waitFor(() => seen.some((p) => p.includes('page=2')), 'page 2 requested')
    expect(seen.at(-1)).toContain('page=2')
  })

  it('drops the parameter on the way back to the first page', async () => {
    total = 120
    const wrapper = await mount('/admin/withdrawals?page=2')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Zurück'))!
      .trigger('click')

    await waitFor(() => useRouter().currentRoute.value.query.page === undefined, 'URL without page')
    expect(useRouter().currentRoute.value.query).not.toHaveProperty('page')
  })

  it('hides the pager for a single page', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Seite 1')
  })
})
