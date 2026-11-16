import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'

import LegalText from './LegalText.vue'

/** Prints the server-rendered HTML of the live version, or says why it cannot. */
let fail = false
let html: string | null = '<h2>Angaben</h2><p>Musterweg 1</p>'

registerEndpoint('/api/legal/impressum', () => {
  if (fail) throw createError({ statusCode: 500, statusMessage: 'kaputt' })
  return {
    slug: 'impressum',
    title: 'Impressum',
    html,
    versionNo: html ? 2 : null,
    activatedAt: html ? '2026-10-01T00:00:00.000Z' : null,
  }
})

beforeEach(() => {
  fail = false
  html = '<h2>Angaben</h2><p>Musterweg 1</p>'
  clearNuxtData()
})

describe('LegalText', () => {
  it('renders the HTML as markup, not as text', async () => {
    const wrapper = await mountSuspended(LegalText, { props: { slug: 'impressum' } })

    const content = wrapper.get('[data-testid="legal-content"]')
    expect(content.classes()).toContain('legal-content')
    expect(content.get('h2').text()).toBe('Angaben')
  })

  it('says the text is unavailable while no version is live', async () => {
    html = null

    const wrapper = await mountSuspended(LegalText, { props: { slug: 'impressum' } })

    expect(wrapper.find('[data-testid="legal-content"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="legal-unavailable"]').text()).toContain(
      'vorübergehend nicht verfügbar',
    )
  })

  it('says the same when the request fails', async () => {
    fail = true

    const wrapper = await mountSuspended(LegalText, { props: { slug: 'impressum' } })

    expect(wrapper.find('[data-testid="legal-unavailable"]').exists()).toBe(true)
  })
})
