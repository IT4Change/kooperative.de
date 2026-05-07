<template>
  <div>
    <h3 class="text-lg font-semibold mb-4">Bestellung prüfen</h3>

    <div v-if="user" class="mb-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-2">Lieferadresse</h4>
      <div class="text-sm text-gray-600 space-y-0.5">
        <p>{{ user.firstname }} {{ user.lastname }}</p>
        <p>{{ user.address.street }}</p>
        <p>{{ user.address.postcode }} {{ user.address.city }}</p>
        <p>{{ user.email }}<span v-if="user.telephone"> · {{ user.telephone }}</span></p>
      </div>
      <p class="text-xs text-gray-400 mt-1">
        Adresse falsch?
        <a :href="accountUrl" target="_blank" rel="noopener" class="text-[#00af8c] underline">Im alten Shop bearbeiten</a>
      </p>
    </div>

    <div class="mb-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-2">Artikel</h4>
      <div class="space-y-1">
        <div v-for="item in items" :key="`${item.product.id}-${item.variantIndex ?? 'base'}`" class="flex justify-between text-sm">
          <span class="text-gray-600">
            {{ item.quantity }}x {{ item.product.name }}
            <span v-if="getVariant(item)" class="text-gray-400">({{ getVariant(item)!.size }})</span>
          </span>
          <span class="font-medium">{{ (getItemPrice(item) * item.quantity).toFixed(2) }} €</span>
        </div>
      </div>
    </div>

    <div class="mb-4 border-t border-gray-100 pt-3 text-sm space-y-1.5">
      <div class="flex justify-between">
        <span class="text-gray-500">Zwischensumme</span>
        <span>{{ totalPrice.toFixed(2) }} €</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Versand: {{ shippingDisplay?.module ?? '–' }}</span>
        <span>{{ shippingDisplay?.price ?? '–' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Zahlung</span>
        <span>{{ paymentDisplay?.label ?? '–' }}</span>
      </div>
      <div v-if="payment === 'lastschrift' && iban" class="flex justify-between text-xs text-gray-500">
        <span>IBAN</span>
        <span class="font-mono">{{ maskedIban }}</span>
      </div>
      <div class="flex justify-between font-bold pt-2 border-t border-gray-200">
        <span>Gesamt</span>
        <span>{{ totalPrice.toFixed(2) }}<span v-if="hasNoFixedShipping" class="text-xs font-normal text-gray-500"> + Versand n. A.</span> €</span>
      </div>
    </div>

    <div v-if="notes" class="mb-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-1">Anmerkungen</h4>
      <p class="text-sm text-gray-600 whitespace-pre-wrap">{{ notes }}</p>
    </div>

    <p v-if="submitError" class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
      {{ submitError }}
    </p>

    <div class="flex gap-3 pt-2">
      <button
        type="button"
        class="flex-1 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        :disabled="submitting"
        @click="$emit('back')"
      >
        Zurück
      </button>
      <KoopButton size="sm" :disabled="submitting" @click="$emit('send')">
        {{ submitting ? 'Sende…' : 'Bestellung absenden' }}
      </KoopButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CartItem, ProductVariant } from '~/data/products'
import { SHIPPING_OPTIONS, PAYMENT_OPTIONS, type ShippingMethod, type PaymentMethod } from '~/data/checkoutOptions'

const props = defineProps<{
  items: readonly CartItem[]
  totalPrice: number
  shipping: ShippingMethod | null
  payment: PaymentMethod | null
  iban: string
  notes: string
  submitting: boolean
  submitError: string
}>()

defineEmits<{ back: [], send: [] }>()

const { user } = useAuth()
const accountUrl = 'https://shop.kooperative.de/account.php'

const shippingDisplay = computed(() => SHIPPING_OPTIONS.find(o => o.id === props.shipping))
const paymentDisplay = computed(() => PAYMENT_OPTIONS.find(o => o.id === props.payment))
const hasNoFixedShipping = computed(() => shippingDisplay.value?.price === 'nach Aufwand')
const maskedIban = computed(() => {
  const i = props.iban.replace(/\s+/g, '').toUpperCase()
  if (i.length < 8) return '••••'
  return i.slice(0, 4) + ' •••• •••• ' + i.slice(-4)
})

function getVariant(item: CartItem): ProductVariant | null {
  if (item.variantIndex !== undefined && item.product.variants) {
    return item.product.variants[item.variantIndex] ?? null
  }
  return null
}

function getItemPrice(item: CartItem): number {
  return getVariant(item)?.price ?? item.product.price
}
</script>
