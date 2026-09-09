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

/** The button that leaves the cart step. */
const proceed = () =>
  [...document.body.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Zur Bestellung'),
  )

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

  it('closes on the close button', async () => {
    const cart = await freshCart()
    await mountSuspended(CartSidebar)
    cart.openCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    document.body.querySelector<HTMLElement>('[aria-label="Schließen"]')!.click()
    await nextTick()

    expect(cart.isOpen.value).toBe(false)
  })

  it('closes on a click beside the panel', async () => {
    const cart = await freshCart()
    await mountSuspended(CartSidebar)
    cart.openCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // The dimmed backdrop is a click target of its own.
    document.body.querySelector<HTMLElement>('.bg-black\\/40')!.click()
    await nextTick()

    expect(cart.isOpen.value).toBe(false)
  })

  it('closes on a click into the empty strip beside the panel', async () => {
    const cart = await freshCart()
    await mountSuspended(CartSidebar)
    cart.openCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // @click.self — only a click on the container itself, not one bubbling up
    // from the panel, may close the sheet.
    // The <Transition> around the panel is stubbed, so walk up by class rather
    // than by parentElement.
    const overlay = panel()!.closest<HTMLElement>('.justify-end')!
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(cart.isOpen.value).toBe(false)
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

  it('sends a signed-in customer straight to shipping and payment', async () => {
    const cart = await openWithItem()
    const { useAuth } = await import('../../composables/useAuth')
    fetchMock.mockResolvedValue({
      authenticated: true,
      customerId: 3,
      email: 'kundin@example.org',
    })
    await useAuth().refresh()
    await nextTick()

    proceed()!.click()
    await nextTick()

    // No point asking someone to sign in who already is.
    expect(cart.checkoutStep.value).toBe('details')
  })

  it('asks an anonymous customer to sign in when they proceed', async () => {
    const cart = await openWithItem()
    const { useAuth } = await import('../../composables/useAuth')
    fetchMock.mockResolvedValue({ authenticated: false })
    await useAuth().refresh()
    await nextTick()

    proceed()!.click()
    await nextTick()

    expect(cart.checkoutStep.value).toBe('auth')
  })

  it('carries every choice of the details step back into the cart', async () => {
    const cart = await openWithItem()
    cart.goToDetails()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const pick = (name: string, value: string) => {
      document.body
        .querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!
        .click()
    }
    const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
      el.value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }

    pick('shipping', 'abholung')
    // Lastschrift is the only method that asks for bank details.
    pick('payment', 'lastschrift')
    await nextTick()
    type(document.body.querySelector('textarea')!, 'Bitte klingeln')
    type(document.body.querySelector<HTMLInputElement>('[id$="-account-holder"]')!, 'Erika Muster')
    type(document.body.querySelector<HTMLInputElement>('[id$="-iban"]')!, 'DE02120300000000202051')
    await nextTick()

    // The sidebar owns the state; the step only reports upwards.
    expect(cart.shippingMethod.value).toBe('abholung')
    expect(cart.paymentMethod.value).toBe('lastschrift')
    expect(cart.orderNotes.value).toBe('Bitte klingeln')
    expect(cart.bankAccountHolder.value).toBe('Erika Muster')
    expect(cart.bankIban.value).toBe('DE02120300000000202051')
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
