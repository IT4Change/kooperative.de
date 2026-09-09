import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import CartSidebar from './CartSidebar.vue'

import type { Product } from '~/data/products'

/**
 * The cart panel. It hosts the whole checkout, so what is tested here is the
 * step machine and the dialog shell — the individual steps have their own specs.
 *
 * The panel is teleported to <body>, so assertions look at document.body rather
 * than at the wrapper.
 */
const CONSENT_KEY = 'kooperative-consent-v1'
const fetchMock = vi.fn()

/**
 * No vi.resetModules() here on purpose: the component imports useCart itself, so
 * resetting would hand the test a second, unrelated singleton and the two would
 * never see each other's state. The shared instance is reset by hand instead.
 */

const HONIG = {
  id: '1',
  name: 'Honig',
  price: 11.9,
  description: '',
  category: 'lebensmittel',
  images: [],
  slug: 'honig',
} as Product

async function freshCart() {
  localStorage.clear()
  localStorage.setItem(CONSENT_KEY, 'true')
  globalThis.$fetch = fetchMock as unknown as typeof $fetch
  const { useCart } = await import('../../composables/useCart')
  const cart = useCart()
  cart.clearCart()
  cart.closeCart()
  cart.goToCart()
  cart.shippingMethod.value = null
  cart.paymentMethod.value = null
  await new Promise((resolve) => setTimeout(resolve, 0))
  return cart
}

const panel = () => document.body.querySelector('[data-testid="cart-sidebar"]')
const bodyText = () => document.body.textContent

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ products: [] })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('visibility', () => {
  it('stays closed until the cart is opened', async () => {
    await freshCart()

    await mountSuspended(CartSidebar)

    expect(panel()).toBeNull()
  })

  it('opens as a modal dialog', async () => {
    const cart = await freshCart()
    await mountSuspended(CartSidebar)

    cart.openCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(panel()?.getAttribute('role')).toBe('dialog')
    expect(panel()?.getAttribute('aria-modal')).toBe('true')
  })

  it('names itself after the current step', async () => {
    const cart = await freshCart()
    await mountSuspended(CartSidebar)
    cart.openCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const title = document.body.querySelector(`#${panel()?.getAttribute('aria-labelledby')}`)
    expect(title?.textContent).toContain('Bestellliste')
  })
})

describe('cart step', () => {
  it('says so when the list is empty', async () => {
    const cart = await freshCart()
    await mountSuspended(CartSidebar)
    cart.openCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bodyText()).toContain('Deine Bestellliste ist leer.')
  })

  it('lists the items with the total', async () => {
    const cart = await freshCart()
    cart.addToCart(HONIG)
    await mountSuspended(CartSidebar)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bodyText()).toContain('Honig')
    expect(document.body.querySelector('[data-testid="cart-total"]')?.textContent).toContain(
      '11.90',
    )
  })

  it('offers the way into the checkout only with items', async () => {
    const cart = await freshCart()
    await mountSuspended(CartSidebar)
    cart.openCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bodyText()).not.toContain('Zur Bestellung')
  })
})

describe('step machine', () => {
  async function openWithItem() {
    const cart = await freshCart()
    cart.addToCart(HONIG)
    await mountSuspended(CartSidebar)
    await new Promise((resolve) => setTimeout(resolve, 0))
    return cart
  }

  it('asks an anonymous customer to sign in first', async () => {
    const cart = await openWithItem()

    cart.goToAuth()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bodyText()).toContain('Anmelden')
  })

  it('walks on to shipping and payment', async () => {
    const cart = await openWithItem()

    cart.goToDetails()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bodyText()).toContain('Versandart')
  })

  it('shows the summary before sending', async () => {
    const cart = await openWithItem()
    cart.shippingMethod.value = 'abholung'
    cart.paymentMethod.value = 'vorkasse'

    cart.goToConfirm()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bodyText()).toContain('Bestellung absenden')
  })

  it('explains the confirmation mail after sending', async () => {
    const cart = await openWithItem()
    cart.shippingMethod.value = 'abholung'
    cart.paymentMethod.value = 'vorkasse'
    fetchMock.mockResolvedValue({ ok: true, pendingId: 12, total: 11.9 })

    await cart.submitOrder()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // The contract only comes about through the customer's reply, so this
    // screen has to say so rather than just "thank you".
    expect(bodyText()).toContain('Vielen Dank!')
    expect(bodyText()).toContain('Bestätigungs-E-Mail')
    expect(document.body.querySelector('[data-testid="cart-success"]')).not.toBeNull()
  })
})
