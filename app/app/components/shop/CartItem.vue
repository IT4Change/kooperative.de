<template>
  <div class="py-3 border-b border-gray-100">
    <div class="flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-medium text-gray-900 truncate">
          {{ item.product.name }}
          <span v-if="activeVariant" class="font-normal text-gray-500">&middot; {{ activeVariant.size }}</span>
        </h4>
        <p class="text-sm text-gray-500">{{ price.toFixed(2) }} €</p>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold transition-colors"
          @click="$emit('update', item.product.id, item.quantity - 1, item.variantIndex)"
        >
          −
        </button>
        <span class="w-8 text-center text-sm font-medium">{{ item.quantity }}</span>
        <button
          class="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold transition-colors"
          @click="$emit('update', item.product.id, item.quantity + 1, item.variantIndex)"
        >
          +
        </button>
      </div>
      <span class="text-sm font-semibold text-gray-900 w-16 text-right">
        {{ (price * item.quantity).toFixed(2) }}&nbsp;€
      </span>
      <button
        class="text-gray-400 hover:text-red-500 transition-colors"
        aria-label="Entfernen"
        @click="$emit('remove', item.product.id, item.variantIndex)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Varianten-Wechsel + Spar-Hinweis -->
    <div v-if="item.product.variants && item.product.variants.length > 1" class="mt-2 ml-0">
      <select
        :value="item.variantIndex ?? 0"
        class="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#4a7c59] focus:border-[#4a7c59]"
        @change="onVariantChange(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="(v, idx) in item.product.variants" :key="idx" :value="idx">
          {{ v.size }} – {{ v.price.toFixed(2) }} € · {{ unitPrice(v).toFixed(2) }} €/{{ v.referenceUnit }}
        </option>
      </select>
      <p v-if="savingsHint" class="text-xs text-[#4a7c59] mt-1">
        {{ savingsHint }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CartItem } from '~/data/products'
import { unitPrice } from '~/data/products'

const props = defineProps<{
  item: CartItem
}>()

const emit = defineEmits<{
  update: [productId: string, quantity: number, variantIndex?: number]
  remove: [productId: string, variantIndex?: number]
  'update-variant': [productId: string, oldVariantIndex: number | undefined, newVariantIndex: number]
}>()

const activeVariant = computed(() =>
  props.item.variantIndex !== undefined && props.item.product.variants
    ? props.item.product.variants[props.item.variantIndex]
    : null,
)

const price = computed(() =>
  activeVariant.value?.price ?? props.item.product.price,
)

const savingsHint = computed(() => {
  const variants = props.item.product.variants
  if (!variants || props.item.variantIndex === undefined) return null

  const current = variants[props.item.variantIndex]
  if (!current) return null
  const currentUP = unitPrice(current)

  // Find cheapest unit price
  let cheapest = current
  let cheapestUP = currentUP
  for (const v of variants) {
    const vUP = unitPrice(v)
    if (vUP < cheapestUP) {
      cheapest = v
      cheapestUP = vUP
    }
  }

  if (cheapest === current) return null

  const savings = (currentUP - cheapestUP).toFixed(2)
  return `Tipp: Im ${cheapest.size}-Gebinde sparst du ${savings} €/${current.referenceUnit}!`
})

function onVariantChange(value: string) {
  emit('update-variant', props.item.product.id, props.item.variantIndex, Number(value))
}
</script>
