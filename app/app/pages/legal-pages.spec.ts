import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi } from 'vitest'

import AgbPage from './agb.vue'
import DatenschutzPage from './datenschutz.vue'
import ImpressumPage from './impressum.vue'
import VersandPage from './versand.vue'
import WiderrufPage from './widerruf.vue'

import { LEGAL_PAGES } from '~/data/legalPages'

/**
 * The legal pages on their own URLs — what direct links, search engines and a
 * browser without JavaScript get. Each is the same view on a different slug.
 */
for (const page of LEGAL_PAGES) {
  registerEndpoint(`/api/legal/${page.slug}`, () => ({
    slug: page.slug,
    title: page.title,
    html: `<p>Live-Text ${page.slug}</p>`,
    versionNo: 1,
    activatedAt: '2026-10-01T00:00:00.000Z',
  }))
}

const PAGES = [
  ['impressum', ImpressumPage],
  ['datenschutz', DatenschutzPage],
  ['agb', AgbPage],
  ['widerruf', WiderrufPage],
  ['versand', VersandPage],
] as const

describe.each(PAGES)('/%s', (slug, Page) => {
  const page = LEGAL_PAGES.find((p) => p.slug === slug)!

  it('shows the title and the live text', async () => {
    const wrapper = await mountSuspended(Page, { route: page.path })

    expect(wrapper.get('h1').text()).toBe(page.title)
    expect(wrapper.get('[data-testid="legal-content"]').text()).toBe(`Live-Text ${slug}`)
  })

  it('links to the other legal pages, not to itself', async () => {
    const wrapper = await mountSuspended(Page, { route: page.path })
    const hrefs = wrapper.findAll('nav a').map((a) => a.attributes('href'))

    expect(hrefs).toStrictEqual(LEGAL_PAGES.filter((p) => p.slug !== slug).map((p) => p.path))
  })
})

describe('page head', () => {
  it('names the page in the document title', async () => {
    await mountSuspended(WiderrufPage, { route: '/widerruf' })

    await vi.waitFor(() => {
      expect(document.title).toBe('Widerrufsbelehrung – Kooperative Dürnau')
    })
  })
})
