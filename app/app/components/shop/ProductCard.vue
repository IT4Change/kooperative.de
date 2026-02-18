<template>
  <div class="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
    <NuxtLink :to="`/shop/${product.id}`">
      <ShopProductGallery :images="product.images" />
    </NuxtLink>
    <div class="p-5 flex flex-col flex-1">
      <NuxtLink :to="`/shop/${product.id}`" class="hover:text-[#4a7c59] transition-colors">
        <h3 class="text-base font-semibold text-gray-900 mb-1">{{ product.name }}</h3>
      </NuxtLink>
      <p class="text-sm text-gray-500 mb-3 flex-1">{{ product.description }}</p>
      <div class="flex items-center justify-between">
        <span class="text-lg font-bold text-[#4a7c59]">
          {{ product.price.toFixed(2) }}&nbsp;€
          <span v-if="product.unit" class="text-xs font-normal text-gray-400">/ {{ product.unit }}</span>
        </span>
        <button
          class="px-3 py-1.5 bg-[#4a7c59] text-white text-sm rounded hover:bg-[#3d6a4a] transition-colors"
          @click="$emit('add', product)"
        >
          In den Warenkorb
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/data/products'

defineProps<{
  product: Product
}>()

defineEmits<{
  add: [product: Product]
}>()
</script>
