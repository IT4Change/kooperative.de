<template>
  <div class="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
    <NuxtLink :to="`/shop/${product.id}`">
      <ShopProductGallery :images="displayImages" />
    </NuxtLink>
    <div class="p-5 flex flex-col flex-1">
      <NuxtLink :to="`/shop/${product.id}`" class="hover:text-[#4a7c59] transition-colors">
        <h3 class="text-base font-semibold text-gray-900 mb-1">{{ product.name }}</h3>
      </NuxtLink>
      <p class="text-sm text-gray-500 mb-3 flex-1">{{ product.description }}</p>

      <!-- Varianten-Dropdown -->
      <div v-if="product.variants" class="mb-3">
        <select
          v-model.number="selectedVariant"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#4a7c59] focus:border-[#4a7c59]"
        >
          <option v-for="(v, idx) in product.variants" :key="idx" :value="idx">
            {{ v.size }} · {{ unitPrice(v).toFixed(2) }} €/{{ v.referenceUnit }}
          </option>
        </select>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <span class="text-lg font-bold text-[#4a7c59]">
            {{ displayPrice.toFixed(2) }}&nbsp;€
          </span>
          <span v-if="product.variants" class="block text-xs text-gray-400">
            {{ displayUnitPrice }} €/{{ activeVariant!.referenceUnit }}
          </span>
          <span v-else-if="product.unit" class="text-xs font-normal text-gray-400">/ {{ product.unit }}</span>
        </div>
        <button
          class="px-3 py-1.5 bg-[#4a7c59] text-white text-sm rounded hover:bg-[#3d6a4a] transition-colors"
          @click="$emit('add', product, product.variants ? selectedVariant : undefined)"
        >
          In den Warenkorb
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/data/products'
import { unitPrice } from '~/data/products'

const props = defineProps<{
  product: Product
}>()

defineEmits<{
  add: [product: Product, variantIndex?: number]
}>()

const selectedVariant = ref(0)

const activeVariant = computed(() =>
  props.product.variants?.[selectedVariant.value],
)

const displayPrice = computed(() =>
  activeVariant.value?.price ?? props.product.price,
)

const displayUnitPrice = computed(() =>
  activeVariant.value ? unitPrice(activeVariant.value).toFixed(2) : '',
)

const displayImages = computed(() =>
  activeVariant.value ? [activeVariant.value.image] : props.product.images,
)
</script>
