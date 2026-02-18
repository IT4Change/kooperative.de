<template>
  <div class="flex items-start gap-3 py-3 border-b border-gray-100">
    <div class="flex-1 min-w-0">
      <h4 class="text-sm font-medium text-gray-900 truncate">{{ item.product.name }}</h4>
      <p class="text-sm text-gray-500">{{ item.product.price.toFixed(2) }} €</p>
    </div>
    <div class="flex items-center gap-1">
      <button
        class="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold transition-colors"
        @click="$emit('update', item.product.id, item.quantity - 1)"
      >
        −
      </button>
      <span class="w-8 text-center text-sm font-medium">{{ item.quantity }}</span>
      <button
        class="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold transition-colors"
        @click="$emit('update', item.product.id, item.quantity + 1)"
      >
        +
      </button>
    </div>
    <span class="text-sm font-semibold text-gray-900 w-16 text-right">
      {{ (item.product.price * item.quantity).toFixed(2) }}&nbsp;€
    </span>
    <button
      class="text-gray-400 hover:text-red-500 transition-colors"
      aria-label="Entfernen"
      @click="$emit('remove', item.product.id)"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CartItem } from '~/data/products'

defineProps<{
  item: CartItem
}>()

defineEmits<{
  update: [productId: string, quantity: number]
  remove: [productId: string]
}>()
</script>
