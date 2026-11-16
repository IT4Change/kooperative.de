import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'

import LegalLink from './LegalLink.vue'

/**
 * A plain left click opens the legal dialog in place; everything else keeps its
 * browser meaning, because the element is a real link to the standalone page.
 */
beforeEach(() => {
  useLegal().close()
})

describe('LegalLink', () => {
  it('links to the standalone page, labelled with the page name', async () => {
    const wrapper = await mountSuspended(LegalLink, { props: { slug: 'versand' } })

    expect(wrapper.get('a').attributes('href')).toBe('/versand')
    expect(wrapper.text()).toBe('Versand & Zahlung')
  })

  it('takes a custom label', async () => {
    const wrapper = await mountSuspended(LegalLink, {
      props: { slug: 'agb' },
      slots: { default: () => 'unsere AGB' },
    })

    expect(wrapper.text()).toBe('unsere AGB')
  })

  it('opens the dialog on a plain click instead of navigating', async () => {
    const wrapper = await mountSuspended(LegalLink, { props: { slug: 'widerruf' } })
    const event = new MouseEvent('click', { button: 0, cancelable: true, bubbles: true })

    wrapper.get('a').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(useLegal().current.value).toBe('widerruf')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('leaves a %s click to the browser', async (_label, init) => {
    const wrapper = await mountSuspended(LegalLink, { props: { slug: 'widerruf' } })
    const event = new MouseEvent('click', { button: 0, ...init, cancelable: true, bubbles: true })

    wrapper.get('a').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(useLegal().current.value).toBeNull()
    expect(wrapper.emitted('open')).toBeUndefined()
  })
})
