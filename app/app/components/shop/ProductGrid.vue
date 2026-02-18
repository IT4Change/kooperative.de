<template>
  <div v-if="products.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <ShopProductCard
      v-for="product in products"
      :key="product.id"
      :product="product"
      @add="$emit('add', $event)"
    />
  </div>
  <p v-else class="text-center text-gray-400 py-12">
    Keine Produkte in dieser Kategorie.
  </p>
</template>

<script setup lang="ts">
import type { Product } from '~/data/products'

defineProps<{
  products: Product[]
}>()

defineEmits<{
  add: [product: Product]
}>()
</script>
