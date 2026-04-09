import type { CartItem, OrderFormData, Product } from '~/data/products'
import { findTierIndex } from '~/data/products'

type CheckoutStep = 'cart' | 'form' | 'confirm'

const STORAGE_KEY = 'kooperative-cart'

const items = ref<CartItem[]>([])
const isOpen = ref(false)
const checkoutStep = ref<CheckoutStep>('cart')
const orderFormData = ref<OrderFormData>({
  name: '',
  street: '',
  zip: '',
  city: '',
  email: '',
  phone: '',
  notes: '',
})

let initialized = false

export function useCart() {
  const storage = useStorage()

  function persist() {
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

  function addToCart(product: Product, variantIndex?: number, quantity?: number) {
    if (!storage.require()) return

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

  function goToForm() {
    checkoutStep.value = 'form'
  }

  function goToConfirm() {
    checkoutStep.value = 'confirm'
  }

  function goToCart() {
    checkoutStep.value = 'cart'
  }

  function generateMailtoLink(): string {
    const fd = orderFormData.value
    const lines: string[] = [
      'Bestellung von der Kooperative Dürnau',
      '',
      'Kontaktdaten:',
      `Name: ${fd.name}`,
      `Straße: ${fd.street}`,
      `PLZ/Ort: ${fd.zip} ${fd.city}`,
      `E-Mail: ${fd.email}`,
      `Telefon: ${fd.phone || '–'}`,
      '',
      'Bestellte Artikel:',
    ]

    for (const item of items.value) {
      const price = itemPrice(item)
      const subtotal = (price * item.quantity).toFixed(2)
      const variant = item.variantIndex !== undefined && item.product.variants
        ? item.product.variants[item.variantIndex]
        : null
      const sizeSuffix = variant ? ` (${variant.size})` : ''
      lines.push(`- ${item.quantity}x ${item.product.name}${sizeSuffix} (${price.toFixed(2)} €) = ${subtotal} €`)
    }

    lines.push('')
    lines.push(`Gesamtsumme: ${totalPrice.value.toFixed(2)} €`)

    if (fd.notes) {
      lines.push('')
      lines.push(`Anmerkungen: ${fd.notes}`)
    }

    const subject = encodeURIComponent('Bestellung – Kooperative Dürnau')
    const body = encodeURIComponent(lines.join('\n'))
    return `mailto:shop@kooperative.de?subject=${subject}&body=${body}`
  }

  init()

  return {
    items: readonly(items),
    isOpen: readonly(isOpen),
    checkoutStep: readonly(checkoutStep),
    orderFormData,
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
    goToForm,
    goToConfirm,
    goToCart,
    generateMailtoLink,
  }
}
