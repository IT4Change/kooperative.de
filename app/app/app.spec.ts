import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import App from './app.vue'

/**
 * The root component. It is three Nuxt built-ins in a row, so the only thing
 * worth pinning is that they are all there — losing the route announcer would
 * silently take screen-reader navigation feedback away, and losing the layout
 * would strip header and footer off every page at once.
 */
describe('app', () => {
  it('wraps the page in the layout and announces route changes', async () => {
    const wrapper = await mountSuspended(App, { route: '/impressum' })

    expect(wrapper.findComponent({ name: 'NuxtRouteAnnouncer' }).exists()).toBe(true)
    // The layout brings the header and footer with it.
    expect(wrapper.find('.header').exists()).toBe(true)
    expect(wrapper.find('.footer').exists()).toBe(true)
    // And the page itself is rendered inside it.
    expect(wrapper.get('main').text()).toContain('Impressum')
  })
})
