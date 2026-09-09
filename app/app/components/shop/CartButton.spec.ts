import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import CartButton from './CartButton.vue'

/**
 * The floating cart button. It only exists once something is on the list — an
 * empty cart button would be a dead end.
 */
const CONSENT_KEY = 'kooperative-consent-v1'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(CONSENT_KEY, 'true')
  globalThis.$fetch = vi.fn().mockResolvedValue({ products: [] }) as unknown as typeof $fetch
})

describe('CartButton', () => {
  it('stays hidden while the cart is empty', async () => {
    const wrapper = await mountSuspended(CartButton)

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('appears with the item count once something is added', async () => {
    const { useCart } = await import('../../composables/useCart')
    const cart = useCart()
    cart.addToCart({
      id: '1',
      name: 'Honig',
      price: 11.9,
      description: '',
      category: 'lebensmittel',
      images: [],
      slug: 'honig',
    })

    const wrapper = await mountSuspended(CartButton)

    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).toContain('1')
    expect(wrapper.get('button').attributes('aria-label')).toBe('Bestellliste öffnen')
    cart.clearCart()
  })

  it('opens the cart when pressed', async () => {
    const { useCart } = await import('../../composables/useCart')
    const cart = useCart()
    cart.addToCart({
      id: '1',
      name: 'Honig',
      price: 11.9,
      description: '',
      category: 'lebensmittel',
      images: [],
      slug: 'honig',
    })
    cart.closeCart()
    const wrapper = await mountSuspended(CartButton)

    await wrapper.get('button').trigger('click')

    expect(cart.isOpen.value).toBe(true)
    cart.clearCart()
    cart.closeCart()
  })
})
