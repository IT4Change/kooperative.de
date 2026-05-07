import type { CartItem, Product } from '~/data/products'
import { findTierIndex } from '~/data/products'
import type { ShippingMethod, PaymentMethod } from '~/data/checkoutOptions'

type CheckoutStep = 'cart' | 'auth' | 'details' | 'confirm' | 'success'

const STORAGE_KEY = 'kooperative-cart'

const items = ref<CartItem[]>([])
const isOpen = ref(false)
const checkoutStep = ref<CheckoutStep>('cart')
const orderNotes = ref('')
const shippingMethod = ref<ShippingMethod | null>(null)
const paymentMethod = ref<PaymentMethod | null>(null)
const bankAccountHolder = ref('')
const bankIban = ref('')
const lastOrderId = ref<number | null>(null)
const submitting = ref(false)
const submitError = ref('')

let initialized = false

export function useCart() {
  const storage = useStorage()
  const consent = useConsent()

  function persist() {
    if (!consent.consentGiven.value) return
    const data = items.value.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      ...(i.variantIndex !== undefined && { variantIndex: i.variantIndex }),
    }))
    storage.set(STORAGE_KEY, JSON.stringify(data))
  }

  async function init() {
    if (initialized || import.meta.server) return
    initialized = true
    if (!consent.consentGiven.value) return
    const raw = storage.get(STORAGE_KEY)
    if (!raw) return
    try {
      const stored: { productId: string; quantity: number; variantIndex?: number }[] = JSON.parse(raw)
      const { products } = await $fetch<{ products: Product[] }>('/api/products')
      const restored: CartItem[] = []
      for (const entry of stored) {
        const product = products.find(p => p.id === entry.productId)
        if (product && entry.quantity > 0) {
          restored.push({
            product,
            quantity: entry.quantity,
            ...(entry.variantIndex !== undefined && { variantIndex: entry.variantIndex }),
          })
        }
      }
      items.value = restored
    } catch {}
  }

  function itemPrice(item: CartItem): number {
    if (item.product.variantType === 'quantity' && item.product.variants) {
      const tierIdx = findTierIndex(item.product.variants, item.quantity)
      return item.product.variants[tierIdx].price
    }
    if (item.variantIndex !== undefined && item.product.variants) {
      return item.product.variants[item.variantIndex]?.price ?? item.product.price
    }
    return item.product.price
  }

  const totalItems = computed(() => items.value.reduce((sum, i) => sum + i.quantity, 0))
  const totalPrice = computed(() => items.value.reduce((sum, i) => sum + itemPrice(i) * i.quantity, 0))
  const isEmpty = computed(() => items.value.length === 0)

  function doAddToCart(product: Product, variantIndex?: number, quantity?: number) {
    if (product.variantType === 'quantity') {
      const existing = items.value.find(i => i.product.id === product.id)
      if (existing) {
        existing.quantity += (quantity ?? 1)
      } else {
        items.value.push({ product, quantity: quantity ?? 1 })
      }
    } else {
      const existing = items.value.find(i =>
        i.product.id === product.id && i.variantIndex === variantIndex,
      )
      if (existing) {
        existing.quantity++
      } else {
        items.value.push({
          product,
          quantity: 1,
          ...(variantIndex !== undefined && { variantIndex }),
        })
      }
    }
    persist()
    openCart()
  }

  function addToCart(product: Product, variantIndex?: number, quantity?: number) {
    if (!storage.require()) return
    consent.require(() => doAddToCart(product, variantIndex, quantity))
  }

  function findItem(productId: string, variantIndex?: number): CartItem | undefined {
    return items.value.find(i =>
      i.product.id === productId && i.variantIndex === variantIndex,
    )
  }

  function removeFromCart(productId: string, variantIndex?: number) {
    items.value = items.value.filter(i =>
      !(i.product.id === productId && i.variantIndex === variantIndex),
    )
    persist()
  }

  function updateQuantity(productId: string, quantity: number, variantIndex?: number) {
    if (quantity <= 0) {
      removeFromCart(productId, variantIndex)
      return
    }
    const item = findItem(productId, variantIndex)
    if (item) {
      item.quantity = quantity
      persist()
    }
  }

  function updateVariant(productId: string, oldVariantIndex: number | undefined, newVariantIndex: number) {
    const item = findItem(productId, oldVariantIndex)
    if (!item) return
    const existing = findItem(productId, newVariantIndex)
    if (existing) {
      existing.quantity += item.quantity
      items.value = items.value.filter(i => i !== item)
    } else {
      item.variantIndex = newVariantIndex
    }
    persist()
  }

  function clearCart() {
    items.value = []
    persist()
  }

  function openCart() {
    checkoutStep.value = 'cart'
    isOpen.value = true
  }

  function closeCart() {
    isOpen.value = false
  }

  function goToAuth() {
    submitError.value = ''
    checkoutStep.value = 'auth'
  }

  function goToDetails() {
    submitError.value = ''
    checkoutStep.value = 'details'
  }

  function goToConfirm() {
    submitError.value = ''
    checkoutStep.value = 'confirm'
  }

  function goToCart() {
    checkoutStep.value = 'cart'
  }

  async function submitOrder(): Promise<boolean> {
    if (!shippingMethod.value || !paymentMethod.value) {
      submitError.value = 'Bitte Versand- und Zahlungsart auswählen'
      return false
    }
    if (paymentMethod.value === 'lastschrift') {
      if (!bankAccountHolder.value.trim() || !bankIban.value.trim()) {
        submitError.value = 'Bitte Kontoinhaber und IBAN angeben'
        return false
      }
    }
    submitting.value = true
    submitError.value = ''
    try {
      const payload: Record<string, unknown> = {
        items: items.value.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          ...(i.variantIndex !== undefined && { variantIndex: i.variantIndex }),
        })),
        shippingMethod: shippingMethod.value,
        paymentMethod: paymentMethod.value,
        ...(orderNotes.value && { notes: orderNotes.value }),
      }
      if (paymentMethod.value === 'lastschrift') {
        payload.bankDetails = {
          accountHolder: bankAccountHolder.value.trim(),
          iban: bankIban.value.replace(/\s+/g, '').toUpperCase(),
        }
      }
      const res = await $fetch<{ ok: boolean, orderId: number }>('/api/orders', {
        method: 'POST',
        body: payload,
      })
      lastOrderId.value = res.orderId
      checkoutStep.value = 'success'
      clearCart()
      orderNotes.value = ''
      shippingMethod.value = null
      paymentMethod.value = null
      bankAccountHolder.value = ''
      bankIban.value = ''
      return true
    } catch (e: unknown) {
      const obj = e as { statusMessage?: string, data?: { statusMessage?: string }, message?: string }
      submitError.value = obj.data?.statusMessage || obj.statusMessage || obj.message || 'Fehler beim Absenden'
      return false
    } finally {
      submitting.value = false
    }
  }

  init()

  return {
    items: readonly(items),
    isOpen: readonly(isOpen),
    checkoutStep: readonly(checkoutStep),
    orderNotes,
    shippingMethod,
    paymentMethod,
    bankAccountHolder,
    bankIban,
    lastOrderId: readonly(lastOrderId),
    submitting: readonly(submitting),
    submitError: readonly(submitError),
    totalItems,
    totalPrice,
    isEmpty,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateVariant,
    itemPrice,
    clearCart,
    openCart,
    closeCart,
    goToAuth,
    goToDetails,
    goToConfirm,
    goToCart,
    submitOrder,
  }
}
