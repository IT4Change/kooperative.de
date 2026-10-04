import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'

import LegalOverview from './index.vue'

/** The overview of the legal texts: what is live on each page, and what waits. */
const ROWS = [
  {
    slug: 'impressum',
    title: 'Impressum',
    versionCount: 2,
    live: {
      versionId: 11,
      versionNo: 1,
      activatedBy: 'system',
      activatedAt: '2026-10-01T08:00:00Z',
    },
    hasNewerDraft: true,
  },
  {
    slug: 'datenschutz',
    title: 'Datenschutzerklärung',
    versionCount: 0,
    live: null,
    hasNewerDraft: false,
  },
]

let fail = false
let failMessage: string | undefined = 'DB weg'

registerEndpoint('/admin/api/legal', () => {
  if (fail) throw createError({ statusCode: 500, statusMessage: failMessage })
  return ROWS
})

beforeEach(() => {
  fail = false
  failMessage = 'DB weg'
  clearNuxtData()
})

const mount = async () => mountSuspended(LegalOverview, { route: '/admin/legal' })

describe('admin legal overview', () => {
  it('shows the live version of each page and flags a waiting draft', async () => {
    const wrapper = await mount()
    const [impressum, datenschutz] = wrapper.findAll('tbody tr')

    expect(impressum.text()).toContain('v1')
    expect(impressum.text()).toContain('seit 01.10.2026, 08:00 · system')
    expect(impressum.text()).toContain('Entwurf')
    expect(impressum.get('a').attributes('href')).toBe('/admin/legal/impressum')

    expect(datenschutz.text()).toContain('keine Version live')
    expect(datenschutz.text()).not.toContain('Entwurf')
  })

  it('reports a failed load', async () => {
    fail = true

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Fehler beim Laden: DB weg')
  })

  it('falls back to the raw error when the server sends no message', async () => {
    fail = true
    failMessage = undefined

    const wrapper = await mount()

    expect(wrapper.text()).toMatch(/Fehler beim Laden: .+/)
  })
})
