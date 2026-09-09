import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'

import AdminDashboard from './index.vue'

/**
 * The admin start page. It is a set of counters, so what matters is that every
 * number links to the list it stands for and that the pending row only appears
 * when there is something pending.
 */
let response: unknown = {}
let status = 200

registerEndpoint('/admin/api/dashboard', () => {
  if (status !== 200) {
    throw createError({ statusCode: status, statusMessage: 'Datenbank weg' })
  }
  return response
})

const FULL = {
  statuses: [
    { id: 1, name: 'In Bearbeitung', count: 1234 },
    { id: 3, name: 'Versendet', count: 7 },
  ],
  pendingCount: 3,
  stats: { customers: 4321, productsActive: 250, reviews: 12 },
}

beforeEach(() => {
  response = FULL
  status = 200
  clearNuxtData()
})

const mount = async () => mountSuspended(AdminDashboard)

describe('order counters', () => {
  it('lists every status with its count', async () => {
    const wrapper = await mount()
    const rows = wrapper.findAll('a').map((a) => a.text().replace(/\s+/g, ' '))

    expect(rows).toContain('In Bearbeitung1.234')
    expect(rows).toContain('Versendet7')
  })

  it('links each status to the filtered list', async () => {
    const wrapper = await mount()

    expect(wrapper.get('a[href="/admin/orders?status=1"]').text()).toContain('In Bearbeitung')
  })

  it('puts the pending orders on top with their own link', async () => {
    const wrapper = await mount()
    const pending = wrapper.get('a[href="/admin/orders?status=pending"]')

    expect(pending.text()).toContain('Bestätigung ausstehend')
    expect(pending.text()).toContain('3')
  })

  it('leaves the pending row out when nothing is pending', async () => {
    response = { ...FULL, pendingCount: 0 }

    const wrapper = await mount()

    expect(wrapper.find('a[href="/admin/orders?status=pending"]').exists()).toBe(false)
  })

  it('colours each status dot by its id', async () => {
    const wrapper = await mount()

    expect(wrapper.get('a[href="/admin/orders?status=3"] span.rounded-full').classes()).toContain(
      'bg-green-100',
    )
  })
})

describe('statistics', () => {
  it('shows the three figures in German grouping', async () => {
    const wrapper = await mount()
    const text = wrapper.text().replace(/\s+/g, ' ')

    expect(text).toContain('Kunden4.321')
    expect(text).toContain('Produkte (aktiv)250')
    expect(text).toContain('Bewertungen12')
  })

  it('links the customer count to the customer list', async () => {
    const wrapper = await mount()

    expect(wrapper.get('a[href="/admin/customers"]').text()).toBe('Kunden')
  })
})

describe('when the database is unreachable', () => {
  it('says so instead of showing zeros as facts', async () => {
    status = 503

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Daten konnten nicht geladen werden')
    expect(wrapper.text()).toContain('Datenbank weg')
  })
})
