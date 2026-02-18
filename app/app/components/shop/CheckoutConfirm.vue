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
        <div v-for="item in items" :key="item.product.id" class="flex justify-between text-sm">
          <span class="text-gray-600">{{ item.quantity }}x {{ item.product.name }}</span>
          <span class="font-medium">{{ (item.product.price * item.quantity).toFixed(2) }} €</span>
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
      <a
        :href="mailtoLink"
        class="flex-1 py-2 text-sm bg-[#4a7c59] text-white rounded hover:bg-[#3d6a4a] transition-colors font-medium text-center"
        @click="$emit('send')"
      >
        Per E-Mail senden
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CartItem, OrderFormData } from '~/data/products'

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
</script>
