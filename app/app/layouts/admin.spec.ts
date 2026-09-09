import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'

import AdminLayout from './admin.vue'

/**
 * The admin shell: sidebar, active marker and the badge for orders still
 * awaiting customer confirmation. The interesting part is `isActive` — the
 * order entry has to stay lit on /admin/pending as well, because pending orders
 * were merged into that list and there is no separate menu entry for them.
 */
let pendingCount = 0

registerEndpoint('/admin/api/dashboard', () => ({ pendingCount }))

// useFetch caches its payload per key for the whole file, so without this every
// mount after the first one would see the count of the first one.
beforeEach(() => {
  clearNuxtData()
})

const mount = async (route: string) => mountSuspended(AdminLayout, { route })

/** Label plus whatever trails it — the badge or the "nur Anzeige" marker. */
const label = (a: { findAll: (s: string) => { text: () => string }[] }) =>
  a
    .findAll('span')
    .map((s) => s.text())
    .join(' ')

const navLabels = (w: Awaited<ReturnType<typeof mount>>) => w.findAll('nav a').map(label)

const activeLink = (w: Awaited<ReturnType<typeof mount>>) =>
  w.findAll('nav a').find((a) => a.classes().includes('bg-[#00af8c]'))

describe('navigation', () => {
  it('lists the four sections', async () => {
    const wrapper = await mount('/admin')

    expect(navLabels(wrapper)).toStrictEqual([
      'Übersicht',
      'Bestellungen',
      'Produkte nur Anzeige',
      'Kunden nur Anzeige',
    ])
  })

  it('marks the section of the current route', async () => {
    const wrapper = await mount('/admin/products')

    expect(label(activeLink(wrapper)!)).toBe('Produkte nur Anzeige')
  })

  it('keeps the order entry lit on a detail page', async () => {
    const wrapper = await mount('/admin/orders/17')

    expect(label(activeLink(wrapper)!)).toBe('Bestellungen')
  })

  it('keeps the order entry lit for a pending order', async () => {
    // /admin/pending has no menu entry of its own — without the extra match it
    // would look as if the operator had left the order area.
    const wrapper = await mount('/admin/pending/17')

    expect(label(activeLink(wrapper)!)).toBe('Bestellungen')
  })

  it('does not light the overview on a subpage', async () => {
    // '/admin' has no `match`, so it must compare for equality, not by prefix.
    const wrapper = await mount('/admin/customers')

    expect(label(activeLink(wrapper)!)).toBe('Kunden nur Anzeige')
  })
})

describe('page title', () => {
  it('names the active section', async () => {
    const wrapper = await mount('/admin/orders')

    expect(wrapper.get('h1').text()).toBe('Bestellungen')
  })

  it('falls back when no section matches', async () => {
    const wrapper = await mount('/admin/does-not-exist')

    expect(wrapper.get('h1').text()).toBe('Administration')
  })
})

describe('pending badge', () => {
  it('stays away while nothing is pending', async () => {
    pendingCount = 0
    const wrapper = await mount('/admin')

    expect(wrapper.find('.bg-amber-400').exists()).toBe(false)
  })

  it('shows the number of orders awaiting confirmation', async () => {
    pendingCount = 3
    const wrapper = await mount('/admin')

    expect(navLabels(wrapper)).toContain('Bestellungen 3')
    pendingCount = 0
  })
})

describe('content', () => {
  it('renders the page into the slot', async () => {
    const wrapper = await mountSuspended(AdminLayout, {
      route: '/admin',
      slots: { default: () => 'Seiteninhalt' },
    })

    expect(wrapper.get('main').text()).toBe('Seiteninhalt')
  })
})
