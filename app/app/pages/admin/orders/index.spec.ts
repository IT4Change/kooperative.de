import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import OrderList from './index.vue'

import { waitFor } from '~~/test/helpers/wait'

/**
 * The order list merges two sources: real osCommerce orders and pending ones
 * that have no order number yet. The status filter is a set of checkboxes whose
 * state lives in the URL — `all`, `none` and a comma list are three different
 * things, and the list has to survive each of them.
 */
interface Row {
  kind: 'order' | 'pending'
  id: number
  customerName: string
  email: string
  datePurchased: string
  statusId: number
  statusName: string | null
  paymentMethod: string
  total: number | null
  origin: 'alt' | 'neu'
}

const ORDER: Row = {
  kind: 'order',
  id: 4711,
  customerName: 'Erika Muster',
  email: 'erika@example.org',
  datePurchased: '2026-03-04T10:15:00',
  statusId: 1,
  statusName: 'In Bearbeitung',
  paymentMethod: 'Rechnung',
  total: 42.5,
  origin: 'alt',
}

const PENDING: Row = {
  kind: 'pending',
  id: 12,
  customerName: '',
  email: 'neu@example.org',
  datePurchased: '2026-03-05T09:00:00',
  statusId: 0,
  statusName: null,
  paymentMethod: 'Lastschrift',
  total: null,
  origin: 'neu',
}

let rows: Row[] = []
let total = 0
let fail = false
let failMessage: string | undefined = 'kaputt'
const seen: Record<string, string>[] = []

// getQuery() is a Nitro auto-import and not available on this side of the
// fence, so the query string is read off the path.
const queryOf = (path: string) => Object.fromEntries(new URLSearchParams(path.split('?')[1] ?? ''))

registerEndpoint('/admin/api/orders', (event) => {
  seen.push(queryOf(event.path))
  if (fail) throw createError({ statusCode: 500, statusMessage: failMessage })
  return { total, page: 1, limit: 50, orders: rows }
})

let unmount: (() => void) | null = null

beforeEach(() => {
  rows = [ORDER, PENDING]
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

async function mount(route = '/admin/orders') {
  const wrapper = await mountSuspended(OrderList, { route })
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
const bodyRows = (w: Awaited<ReturnType<typeof mount>>) => w.findAll('tbody tr')

describe('the table', () => {
  it('shows an order with its number and total', async () => {
    const wrapper = await mount()
    const cells = bodyRows(wrapper)[0]
      .findAll('td')
      .map((c) => c.text().replace(/\s+/g, ' '))

    expect(cells[0]).toBe('4711')
    expect(cells[2]).toContain('Erika Muster')
    expect(cells[2]).toContain('erika@example.org')
    expect(cells[3]).toBe('Alter Shop')
    expect(cells[5]).toBe('42,50 €')
    expect(cells[6]).toBe('In Bearbeitung')
  })

  it('marks a pending order as having no number yet', async () => {
    const wrapper = await mount()
    const cells = bodyRows(wrapper)[1]
      .findAll('td')
      .map((c) => c.text().replace(/\s+/g, ' '))

    expect(cells[0]).toBe('—')
    expect(cells[2]).toContain('—')
    expect(cells[3]).toBe('Neuer Shop')
    // No total is not the same as a total of zero.
    expect(cells[5]).toBe('–')
    expect(cells[6]).toBe('Status 0')
  })

  it('says so when nothing matches', async () => {
    rows = []
    total = 0

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Keine Bestellungen gefunden.')
  })

  it('reports a failing query instead of an empty table', async () => {
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

  it('counts the whole result, not the page', async () => {
    total = 1234

    const wrapper = await mount()

    expect(wrapper.text()).toContain('1.234 Bestellungen')
  })
})

describe('the status filter', () => {
  it('starts on the default selection, which hides completed orders', async () => {
    const wrapper = await mount()
    const checked = wrapper
      .findAll('label')
      .filter((l) => (l.find('input').element as HTMLInputElement).checked)
      .map((l) => l.text())

    expect(checked).toStrictEqual([
      'Bestätigung ausstehend',
      'In Bearbeitung',
      'Vorkasse erwartet',
      'Versandbereit',
    ])
  })

  it('reads a comma list out of the URL', async () => {
    const wrapper = await mount('/admin/orders?status=1,3')
    const checked = wrapper
      .findAll('label')
      .filter((l) => (l.find('input').element as HTMLInputElement).checked)
      .map((l) => l.text())

    expect(checked).toStrictEqual(['In Bearbeitung', 'Versendet'])
  })

  it('understands "all"', async () => {
    const wrapper = await mount('/admin/orders?status=all')

    expect(wrapper.findAll('input[type="checkbox"]:checked')).toHaveLength(5)
  })

  it('understands "none"', async () => {
    const wrapper = await mount('/admin/orders?status=none')

    expect(wrapper.findAll('input[type="checkbox"]:checked')).toHaveLength(0)
  })

  it('ignores a status that does not exist', async () => {
    const wrapper = await mount('/admin/orders?status=1,quatsch')

    expect(wrapper.findAll('input[type="checkbox"]:checked')).toHaveLength(1)
  })

  it('adds a status to the URL when its box is ticked', async () => {
    const wrapper = await mount('/admin/orders?status=1')

    await wrapper.findAll('input[type="checkbox"]')[4].setValue(true)
    await urlBecomes({ status: '1,3' })

    expect(query().status).toBe('1,3')
  })

  it('removes it again when unticked', async () => {
    const wrapper = await mount('/admin/orders?status=1,3')

    await wrapper.findAll('input[type="checkbox"]')[1].trigger('change')
    await urlBecomes({ status: '3' })

    expect(query().status).toBe('3')
  })

  it('writes "none" when the last box is unticked', async () => {
    const wrapper = await mount('/admin/orders?status=1')

    await wrapper.findAll('input[type="checkbox"]')[1].trigger('change')
    await urlBecomes({ status: 'none' })

    // An empty list is a choice too — an absent parameter would mean "default".
    expect(query().status).toBe('none')
  })

  it('collapses a full selection to "all"', async () => {
    const wrapper = await mount('/admin/orders?status=1')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Alle anzeigen')!
      .trigger('click')
    await urlBecomes({ status: 'all' })

    // Shorter and stable against new statuses being added later.
    expect(query().status).toBe('all')
  })

  it('goes back to the default selection', async () => {
    const wrapper = await mount('/admin/orders?status=all')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Standard')!
      .trigger('click')
    await urlBecomes({ status: 'pending,1,4,2' })

    expect(query().status).toBe('pending,1,4,2')
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
    await input.setValue('4711')

    await input.trigger('keyup.enter')
    await urlBecomes({ q: '4711' })

    expect(query().q).toBe('4711')
  })

  it('picks the term up from the URL and passes it to the API', async () => {
    const wrapper = await mount('/admin/orders?q=Muster')

    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('Muster')
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

  it('cannot go back from the first page', async () => {
    total = 120

    const wrapper = await mount()

    expect(wrapper.get('button[disabled]').text()).toContain('Zurück')
  })

  it('cannot go past the last page', async () => {
    total = 120

    const wrapper = await mount('/admin/orders?page=3')

    expect(wrapper.findAll('button[disabled]').at(-1)?.text()).toContain('Weiter')
  })

  it('puts the page into the URL', async () => {
    total = 120
    const wrapper = await mount()

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Weiter'))!
      .trigger('click')
    await urlBecomes({ page: '2' })

    expect(query().page).toBe('2')
  })

  it('leaves the first page out of the URL', async () => {
    total = 120
    const wrapper = await mount('/admin/orders?page=2')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Zurück'))!
      .trigger('click')
    await urlBecomes({ page: undefined })

    expect(query().page).toBeUndefined()
  })

  it('takes a garbled page number for the first one', async () => {
    total = 120

    const wrapper = await mount('/admin/orders?page=quatsch')

    expect(wrapper.text()).toContain('Seite 1 / 3')
  })
})

describe('opening a row', () => {
  it('goes to the order for a real order', async () => {
    const wrapper = await mount()
    const push = vi.spyOn(useRouter(), 'push')

    await bodyRows(wrapper)[0].trigger('click')

    expect(push).toHaveBeenCalledWith('/admin/orders/4711')
    push.mockRestore()
  })

  it('goes to the confirmation view for a pending one', async () => {
    // A pending order has no order number, so /admin/orders/12 would be a
    // different order entirely.
    const wrapper = await mount()
    const push = vi.spyOn(useRouter(), 'push')

    await bodyRows(wrapper)[1].trigger('click')

    expect(push).toHaveBeenCalledWith('/admin/pending/12')
    push.mockRestore()
  })
})
