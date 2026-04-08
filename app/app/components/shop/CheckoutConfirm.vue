<template>
  <div>
    <h3 class="text-lg font-semibold mb-4">Bestellung prüfen</h3>

    <div class="mb-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-2">Kontaktdaten</h4>
      <div class="text-sm text-gray-600 space-y-0.5">
        <p>{{ formData.name }}</p>
        <p>{{ formData.street }}</p>
        <p>{{ formData.zip }} {{ formData.city }}</p>
        <p>{{ formData.email }}</p>
        <p v-if="formData.phone">{{ formData.phone }}</p>
      </div>
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
      <div class="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-gray-200">
        <span>Gesamt</span>
        <span>{{ totalPrice.toFixed(2) }} €</span>
      </div>
    </div>

    <div v-if="formData.notes" class="mb-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-1">Anmerkungen</h4>
      <p class="text-sm text-gray-600">{{ formData.notes }}</p>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        class="flex-1 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        @click="$emit('back')"
      >
        Zurück
      </button>
      <KoopButton :href="mailtoLink" size="sm" @click="$emit('send')">
        Per E-Mail senden
      </KoopButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CartItem, OrderFormData, ProductVariant } from '~/data/products'

defineProps<{
  items: readonly CartItem[]
  totalPrice: number
  formData: OrderFormData
  mailtoLink: string
}>()

defineEmits<{
  back: []
  send: []
}>()

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
