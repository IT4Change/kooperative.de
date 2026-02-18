import type { CartItem, OrderFormData, Product } from '~/data/products'
import { products } from '~/data/products'

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

function persist() {
  if (import.meta.server) return
  const data = items.value.map(i => ({ productId: i.product.id, quantity: i.quantity }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function init() {
  if (initialized || import.meta.server) return
  initialized = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const stored: { productId: string; quantity: number }[] = JSON.parse(raw)
    const restored: CartItem[] = []
    for (const entry of stored) {
      const product = products.find(p => p.id === entry.productId)
      if (product && entry.quantity > 0) {
        restored.push({ product, quantity: entry.quantity })
      }
    }
    items.value = restored
  }
  catch {
    // ignore corrupt data
  }
}

const totalItems = computed(() => items.value.reduce((sum, i) => sum + i.quantity, 0))
const totalPrice = computed(() => items.value.reduce((sum, i) => sum + i.product.price * i.quantity, 0))
const isEmpty = computed(() => items.value.length === 0)

function addToCart(product: Product) {
  const existing = items.value.find(i => i.product.id === product.id)
  if (existing) {
    existing.quantity++
  }
  else {
    items.value.push({ product, quantity: 1 })
  }
  persist()
}

function removeFromCart(productId: string) {
  items.value = items.value.filter(i => i.product.id !== productId)
  persist()
}

function updateQuantity(productId: string, quantity: number) {
  if (quantity <= 0) {
    removeFromCart(productId)
    return
  }
  const item = items.value.find(i => i.product.id === productId)
  if (item) {
    item.quantity = quantity
    persist()
  }
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
    const subtotal = (item.product.price * item.quantity).toFixed(2)
    lines.push(`- ${item.quantity}x ${item.product.name} (${item.product.price.toFixed(2)} €) = ${subtotal} €`)
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

export function useCart() {
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
    clearCart,
    openCart,
    closeCart,
    goToForm,
    goToConfirm,
    goToCart,
    generateMailtoLink,
  }
}
