import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import KoopButton from './KoopButton.vue'

/**
 * The shop's one button. It renders as a link, an anchor or a button depending
 * on what it was given — which matters for keyboard and screen reader users,
 * because a link and a button are operated differently.
 */
describe('KoopButton', () => {
  it('renders a plain button by default', async () => {
    const wrapper = await mountSuspended(KoopButton, { slots: { default: () => 'Absenden' } })

    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).toBe('Absenden')
    expect(wrapper.find('button').attributes('type')).toBe('button')
  })

  it('renders an internal link when given a route', async () => {
    const wrapper = await mountSuspended(KoopButton, {
      props: { to: '/shop' },
      slots: { default: () => 'Zum Shop' },
    })

    // A NuxtLink, not a button — otherwise middle-click and "open in new tab"
    // would silently stop working.
    expect(wrapper.find('a').attributes('href')).toBe('/shop')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders an external anchor when given a href', async () => {
    const wrapper = await mountSuspended(KoopButton, {
      props: { href: 'https://example.org' },
      slots: { default: () => 'Extern' },
    })

    expect(wrapper.find('a').attributes('href')).toBe('https://example.org')
  })

  it('passes the submit type through', async () => {
    const wrapper = await mountSuspended(KoopButton, { props: { type: 'submit' } })

    expect(wrapper.find('button').attributes('type')).toBe('submit')
  })

  it('disables the button', async () => {
    const wrapper = await mountSuspended(KoopButton, { props: { disabled: true } })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('koop-btn--disabled')
  })

  it.each([
    ['orange', 'koop-btn--orange'],
    ['lila', 'koop-btn--lila'],
    ['blue', 'koop-btn--blue'],
  ])('applies the %s variant', async (variant, expected) => {
    const wrapper = await mountSuspended(KoopButton, {
      props: { variant: variant as 'orange' },
    })

    expect(wrapper.classes()).toContain(expected)
  })

  it('adds no modifier for the default variant', async () => {
    const wrapper = await mountSuspended(KoopButton)

    expect(wrapper.classes()).toContain('koop-btn')
    expect(wrapper.classes().some((c) => c.startsWith('koop-btn--'))).toBe(false)
  })

  it('applies the small size', async () => {
    const wrapper = await mountSuspended(KoopButton, { props: { size: 'sm' } })

    expect(wrapper.classes()).toContain('koop-btn--sm')
  })
})
