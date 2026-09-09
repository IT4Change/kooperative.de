import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Product } from '~/data/products'

/**
 * The cart. Everything the customer assembles before checkout lives here, and
 * three things make it more than a list: prices depend on the chosen variant or
 * quantity tier, nothing may be persisted before consent, and the submit path
 * has to leave a usable error behind when it fails.
 *
 * State is module level, so each test imports the composable fresh.
 */
const CONSENT_KEY = 'kooperative-consent-v1'
const CART_KEY = 'kooperative-cart'

const fetchMock = vi.fn()

function product(over: Partial<Product> = {}): Product {
  return {
    id: '1',
    name: 'Honig',
    price: 11.9,
    description: '',
    category: 'lebensmittel',
    images: [],
    slug: 'honig',
    ...over,
  }
}

const SIZED = product({
  id: '3',
  name: 'Olivenöl',
  price: 9.52,
  variants: [
    { productId: '3', size: '0,5 L', price: 9.52, amount: 0.5, referenceUnit: 'L', image: '' },
    { productId: '4', size: '1 L', price: 17.85, amount: 1, referenceUnit: 'L', image: '' },
  ],
})

const TIERED = product({
  id: '5',
  name: 'Karte',
  price: 2.38,
  variantType: 'quantity',
  variants: [
    {
      productId: '5',
      size: '1 Stk.',
      price: 2.38,
      amount: 1,
      referenceUnit: 'Stk',
      image: '',
      minQty: 1,
    },
    {
      productId: '6',
      size: 'ab 10 Stk.',
      price: 1.79,
      amount: 1,
      referenceUnit: 'Stk',
      image: '',
      minQty: 10,
    },
  ],
})

/** A cart with consent already given, so nothing has to be clicked away first. */
async function freshCart({ consent = true } = {}) {
  vi.resetModules()
  localStorage.clear()
  if (consent) localStorage.setItem(CONSENT_KEY, 'true')
  globalThis.$fetch = fetchMock as unknown as typeof $fetch
  const { useCart } = await import('./useCart')
  const cart = useCart()
  await new Promise((resolve) => setTimeout(resolve, 0))
  return cart
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ products: [] })
})

describe('adding items', () => {
  it('adds a product and opens the cart', async () => {
    const cart = await freshCart()

    cart.addToCart(product())

    expect(cart.items.value).toHaveLength(1)
    expect(cart.totalItems.value).toBe(1)
    expect(cart.isOpen.value).toBe(true)
    expect(cart.isEmpty.value).toBe(false)
  })

  it('increments an item that is already on the list', async () => {
    const cart = await freshCart()

    cart.addToCart(product())
    cart.addToCart(product())

    expect(cart.items.value).toHaveLength(1)
    expect(cart.totalItems.value).toBe(2)
  })

  it('counts a tier product up one at a time when no amount is given', async () => {
    const cart = await freshCart()

    cart.addToCart(TIERED)
    cart.addToCart(TIERED)

    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0].quantity).toBe(2)
  })

  it('keeps two sizes of the same product apart', async () => {
    const cart = await freshCart()

    cart.addToCart(SIZED, 0)
    cart.addToCart(SIZED, 1)

    // Two different articles as far as the customer is concerned.
    expect(cart.items.value).toHaveLength(2)
    expect(cart.totalPrice.value).toBeCloseTo(9.52 + 17.85, 2)
  })

  it('adds a quantity-tier product with the chosen amount', async () => {
    const cart = await freshCart()

    cart.addToCart(TIERED, 1, 10)

    expect(cart.items.value[0].quantity).toBe(10)
    // 10 pieces reach the cheaper tier: 10 × 1.79, not 10 × 2.38.
    expect(cart.totalPrice.value).toBeCloseTo(17.9, 2)
  })

  it('sums a tier product up instead of listing it twice', async () => {
    const cart = await freshCart()

    cart.addToCart(TIERED, 0, 6)
    cart.addToCart(TIERED, 0, 6)

    expect(cart.items.value).toHaveLength(1)
    // Twelve together cross into the cheaper tier, which six alone would not.
    expect(cart.items.value[0].quantity).toBe(12)
    expect(cart.totalPrice.value).toBeCloseTo(12 * 1.79, 2)
  })

  it('prices a product without variants at its own price', async () => {
    const cart = await freshCart()

    cart.addToCart(product())

    expect(cart.totalPrice.value).toBeCloseTo(11.9, 2)
  })

  it('falls back to the base price for a variant index out of range', async () => {
    const cart = await freshCart()

    cart.addToCart(SIZED, 9)

    expect(cart.totalPrice.value).toBeCloseTo(9.52, 2)
  })
})

describe('changing the cart', () => {
  it('updates a quantity', async () => {
    const cart = await freshCart()
    cart.addToCart(product())

    cart.updateQuantity('1', 5)

    expect(cart.totalItems.value).toBe(5)
  })

  it('removes an item when the quantity drops to zero', async () => {
    const cart = await freshCart()
    cart.addToCart(product())

    cart.updateQuantity('1', 0)

    expect(cart.isEmpty.value).toBe(true)
  })

  it('ignores an update for an item that is not there', async () => {
    const cart = await freshCart()

    expect(() => {
      cart.updateQuantity('999', 3)
    }).not.toThrow()
    expect(cart.isEmpty.value).toBe(true)
  })

  it('removes a specific size, not the whole product', async () => {
    const cart = await freshCart()
    cart.addToCart(SIZED, 0)
    cart.addToCart(SIZED, 1)

    cart.removeFromCart('3', 0)

    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0].variantIndex).toBe(1)
  })

  it('switches an item to another size', async () => {
    const cart = await freshCart()
    cart.addToCart(SIZED, 0)

    cart.updateVariant('3', 0, 1)

    expect(cart.items.value[0].variantIndex).toBe(1)
    expect(cart.totalPrice.value).toBeCloseTo(17.85, 2)
  })

  it('merges into the existing line when that size is already on the list', async () => {
    const cart = await freshCart()
    cart.addToCart(SIZED, 0)
    cart.addToCart(SIZED, 1)
    cart.updateQuantity('3', 2, 1)

    cart.updateVariant('3', 0, 1)

    // Otherwise the same size would appear twice.
    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0].quantity).toBe(3)
  })

  it('ignores a variant switch for an item that is not there', async () => {
    const cart = await freshCart()

    expect(() => {
      cart.updateVariant('999', 0, 1)
    }).not.toThrow()
  })

  it('empties the cart', async () => {
    const cart = await freshCart()
    cart.addToCart(product())

    cart.clearCart()

    expect(cart.isEmpty.value).toBe(true)
  })
})

describe('persistence', () => {
  it('stores the cart once consent is given', async () => {
    const cart = await freshCart()

    cart.addToCart(SIZED, 1)

    expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toStrictEqual([
      { productId: '3', quantity: 1, variantIndex: 1 },
    ])
  })

  it('stores nothing without consent', async () => {
    const cart = await freshCart({ consent: false })

    cart.addToCart(product())

    // The banner is up; until it is answered, nothing may be written.
    expect(localStorage.getItem(CART_KEY)).toBeNull()
    expect(cart.isEmpty.value).toBe(true)
  })

  it('writes nothing at all while consent is missing', async () => {
    const cart = await freshCart({ consent: false })

    // clearCart persists too — every write has to go through the same gate.
    cart.clearCart()

    expect(localStorage.getItem(CART_KEY)).toBeNull()
  })

  it('refuses to add anything while the browser blocks storage', async () => {
    ;(window as unknown as { __storageBlocked?: boolean }).__storageBlocked = true
    try {
      const cart = await freshCart()

      cart.addToCart(product())

      // Adding without being able to remember it would lose the list on reload.
      expect(cart.isEmpty.value).toBe(true)
    } finally {
      delete (window as unknown as { __storageBlocked?: boolean }).__storageBlocked
    }
  })

  it('restores the chosen size along with the item', async () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    localStorage.setItem(
      CART_KEY,
      JSON.stringify([{ productId: '3', quantity: 1, variantIndex: 1 }]),
    )
    fetchMock.mockResolvedValue({ products: [SIZED] })

    vi.resetModules()
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    const { useCart } = await import('./useCart')
    const cart = useCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(cart.items.value[0]).toMatchObject({ variantIndex: 1, quantity: 1 })
  })

  it('restores a stored cart on the next visit', async () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    localStorage.setItem(CART_KEY, JSON.stringify([{ productId: '1', quantity: 3 }]))
    fetchMock.mockResolvedValue({ products: [product()] })

    vi.resetModules()
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    const { useCart } = await import('./useCart')
    const cart = useCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0].quantity).toBe(3)
  })

  it('drops a stored product that no longer exists', async () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    localStorage.setItem(CART_KEY, JSON.stringify([{ productId: '999', quantity: 1 }]))
    fetchMock.mockResolvedValue({ products: [product()] })

    vi.resetModules()
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    const { useCart } = await import('./useCart')
    const cart = useCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // A discontinued article must not resurrect itself in someone's cart.
    expect(cart.isEmpty.value).toBe(true)
  })

  it('survives a corrupted stored cart', async () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    localStorage.setItem(CART_KEY, '{not json')

    vi.resetModules()
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    const { useCart } = await import('./useCart')
    const cart = useCart()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(cart.isEmpty.value).toBe(true)
  })
})

describe('checkout steps', () => {
  it('walks forward and back through the steps', async () => {
    const cart = await freshCart()

    cart.goToAuth()
    expect(cart.checkoutStep.value).toBe('auth')
    cart.goToDetails()
    expect(cart.checkoutStep.value).toBe('details')
    cart.goToConfirm()
    expect(cart.checkoutStep.value).toBe('confirm')
    cart.goToCart()
    expect(cart.checkoutStep.value).toBe('cart')
  })

  it('closes and reopens on the cart step', async () => {
    const cart = await freshCart()
    cart.goToConfirm()

    cart.closeCart()
    expect(cart.isOpen.value).toBe(false)

    cart.openCart()
    expect(cart.isOpen.value).toBe(true)
    expect(cart.checkoutStep.value).toBe('cart')
  })
})

describe('submitting the order', () => {
  async function readyCart() {
    const cart = await freshCart()
    cart.addToCart(product())
    cart.shippingMethod.value = 'abholung'
    cart.paymentMethod.value = 'vorkasse'
    fetchMock.mockResolvedValue({ ok: true, pendingId: 12, total: 11.9 })
    return cart
  }

  it('sends the chosen size along with the line', async () => {
    const cart = await freshCart()
    cart.addToCart(SIZED, 1)
    cart.shippingMethod.value = 'abholung'
    cart.paymentMethod.value = 'vorkasse'
    fetchMock.mockResolvedValue({ ok: true, pendingId: 12, total: 17.85 })

    await cart.submitOrder()

    // Without the index the server would price the small bottle.
    expect(fetchMock.mock.calls.at(-1)?.[1].body.items).toStrictEqual([
      { productId: '3', quantity: 1, variantIndex: 1 },
    ])
  })

  it('sends the cart and clears it on success', async () => {
    const cart = await readyCart()

    await expect(cart.submitOrder()).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      body: expect.objectContaining({
        items: [{ productId: '1', quantity: 1 }],
        shippingMethod: 'abholung',
        paymentMethod: 'vorkasse',
      }),
    })
    expect(cart.checkoutStep.value).toBe('success')
    expect(cart.isEmpty.value).toBe(true)
  })

  it('resets the checkout fields afterwards', async () => {
    const cart = await readyCart()
    cart.orderNotes.value = 'Bitte klingeln'

    await cart.submitOrder()

    expect(cart.orderNotes.value).toBe('')
    expect(cart.shippingMethod.value).toBeNull()
    expect(cart.paymentMethod.value).toBeNull()
  })

  it('includes the note when there is one', async () => {
    const cart = await readyCart()
    cart.orderNotes.value = 'Bitte klingeln'

    await cart.submitOrder()

    expect(fetchMock.mock.calls[0][1].body.notes).toBe('Bitte klingeln')
  })

  it('normalises the IBAN for a direct debit order', async () => {
    const cart = await readyCart()
    cart.paymentMethod.value = 'lastschrift'
    cart.bankAccountHolder.value = '  Erika Musterfrau  '
    cart.bankIban.value = 'de89 3704 0044 0532 0130 00'

    await cart.submitOrder()

    expect(fetchMock.mock.calls[0][1].body.bankDetails).toStrictEqual({
      accountHolder: 'Erika Musterfrau',
      iban: 'DE89370400440532013000',
    })
  })

  it.each([
    [
      'no shipping method',
      (c: Awaited<ReturnType<typeof readyCart>>) => (c.shippingMethod.value = null),
    ],
    [
      'no payment method',
      (c: Awaited<ReturnType<typeof readyCart>>) => (c.paymentMethod.value = null),
    ],
  ])('refuses to send with %s', async (_label, breakIt) => {
    const cart = await readyCart()
    breakIt(cart)

    await expect(cart.submitOrder()).resolves.toBe(false)
    expect(cart.submitError.value).toContain('Versand- und Zahlungsart')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/orders', expect.anything())
  })

  it('refuses a direct debit without bank details', async () => {
    const cart = await readyCart()
    cart.paymentMethod.value = 'lastschrift'

    await expect(cart.submitOrder()).resolves.toBe(false)
    expect(cart.submitError.value).toContain('Kontoinhaber und IBAN')
  })

  it('shows the server message when the order is rejected', async () => {
    const cart = await readyCart()
    fetchMock.mockRejectedValue({ data: { statusMessage: 'Artikel 1 nicht verfügbar' } })

    await expect(cart.submitOrder()).resolves.toBe(false)
    // The customer needs to know which article dropped out, not "Fehler".
    expect(cart.submitError.value).toBe('Artikel 1 nicht verfügbar')
    // The cart survives, so they can correct it.
    expect(cart.isEmpty.value).toBe(false)
  })

  it('falls back to a generic message for an unrecognisable failure', async () => {
    const cart = await readyCart()
    fetchMock.mockRejectedValue({})

    await cart.submitOrder()

    expect(cart.submitError.value).toBe('Fehler beim Absenden')
  })

  it('clears the busy flag whether it worked or not', async () => {
    const cart = await readyCart()
    fetchMock.mockRejectedValue(new Error('offline'))

    await cart.submitOrder()

    expect(cart.submitting.value).toBe(false)
  })
})
