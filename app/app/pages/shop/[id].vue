<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-24 pb-12 sm:px-6">
    <NuxtLink to="/shop" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#4a7c59] mb-6">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Zurück zum Shop
    </NuxtLink>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <ShopProductGallery :images="displayImages" size="lg" />

      <div class="flex flex-col">
        <span class="text-sm font-medium text-[#4a7c59] bg-[#4a7c59]/10 px-2.5 py-0.5 rounded-full w-fit mb-3">
          {{ categoryName }}
        </span>

        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{{ product.name }}</h1>

        <p class="text-gray-600 mb-6 flex-1">{{ product.description }}</p>

        <!-- Varianten-Dropdown -->
        <div v-if="product.variants" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Gebindegröße</label>
          <select
            v-model.number="selectedVariant"
            class="w-full sm:w-auto text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/40 focus:border-[#4a7c59]"
          >
            <option v-for="(v, idx) in product.variants" :key="idx" :value="idx">
              {{ v.size }} · {{ unitPrice(v).toFixed(2) }} €/{{ v.referenceUnit }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-4 mb-6">
          <span class="text-2xl font-bold text-[#4a7c59]">
            {{ displayPrice.toFixed(2) }}&nbsp;&euro;
          </span>
          <template v-if="product.variants && activeVariant">
            <span class="text-sm text-gray-400">
              {{ displayUnitPrice }} €/{{ activeVariant.referenceUnit }}
            </span>
          </template>
          <span v-else-if="product.unit" class="text-sm text-gray-400">/ {{ product.unit }}</span>
        </div>

        <button
          class="px-6 py-3 bg-[#4a7c59] text-white font-medium rounded-lg hover:bg-[#3d6a4a] transition-colors w-full sm:w-auto"
          @click="addToCart(product, product.variants ? selectedVariant : undefined)"
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
import { products, categories, unitPrice } from '~/data/products'

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

const selectedVariant = ref(0)

const activeVariant = computed(() =>
  product.variants?.[selectedVariant.value],
)

const displayPrice = computed(() =>
  activeVariant.value?.price ?? product.price,
)

const displayUnitPrice = computed(() =>
  activeVariant.value ? unitPrice(activeVariant.value).toFixed(2) : '',
)

const displayImages = computed(() =>
  activeVariant.value ? [activeVariant.value.image] : product.images,
)
</script>
