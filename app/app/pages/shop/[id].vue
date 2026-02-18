<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-24 pb-12 sm:px-6">
    <NuxtLink to="/shop" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#4a7c59] mb-6">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Zurück zum Shop
    </NuxtLink>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <ShopProductGallery :images="product.images" size="lg" />

      <div class="flex flex-col">
        <span class="text-sm font-medium text-[#4a7c59] bg-[#4a7c59]/10 px-2.5 py-0.5 rounded-full w-fit mb-3">
          {{ categoryName }}
        </span>

        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{{ product.name }}</h1>

        <p class="text-gray-600 mb-6 flex-1">{{ product.description }}</p>

        <div class="flex items-center gap-4 mb-6">
          <span class="text-2xl font-bold text-[#4a7c59]">
            {{ product.price.toFixed(2) }}&nbsp;&euro;
          </span>
          <span v-if="product.unit" class="text-sm text-gray-400">/ {{ product.unit }}</span>
        </div>

        <button
          class="px-6 py-3 bg-[#4a7c59] text-white font-medium rounded-lg hover:bg-[#3d6a4a] transition-colors w-full sm:w-auto"
          @click="addToCart(product)"
        >
          In den Warenkorb
        </button>
      </div>
    </div>

    <ShopCartButton />
    <ShopCartSidebar />
  </div>
</template>

<script setup lang="ts">
import { products, categories } from '~/data/products'

const route = useRoute()
const product = products.find(p => p.id === route.params.id)

if (!product) {
  navigateTo('/shop')
  throw new Error('Product not found')
}

const categoryName = categories.find(c => c.slug === product.category)?.name ?? product.category

useHead({
  title: `${product.name} – Kooperative Dürnau`,
})

const { addToCart } = useCart()
</script>
