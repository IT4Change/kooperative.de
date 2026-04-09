<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-24 pb-12 sm:px-6">
    <NuxtLink to="/shop" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#00af8c] mb-6">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Zurück zum Shop
    </NuxtLink>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <ShopProductGallery :images="displayImages" size="lg" />

      <div class="flex flex-col">
        <span class="text-sm font-medium text-[#00af8c] bg-[#00af8c]/10 px-2.5 py-0.5 rounded-full w-fit mb-3">
          {{ categoryName }}
        </span>

        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{{ product.name }}</h1>
        <p v-if="product.model" class="text-xs text-gray-400 mb-3">Art.-Nr. {{ product.model }}</p>

        <p class="text-gray-600 mb-6">{{ product.description }}</p>

        <!-- Size variants: dropdown -->
        <div v-if="product.variants && product.variantType !== 'quantity'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Gebindegröße</label>
          <select
            v-model.number="selectedVariant"
            class="w-full sm:w-auto text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
          >
            <option v-for="(v, idx) in product.variants" :key="idx" :value="idx">
              {{ v.size }} · {{ unitPrice(v).toFixed(2) }} €/{{ v.referenceUnit }}
            </option>
          </select>
        </div>

        <!-- Quantity tiers -->
        <div v-else-if="product.variantType === 'quantity' && product.variants" class="mb-4">
          <div class="flex items-center gap-3 mb-2">
            <label class="text-sm font-medium text-gray-700">Anzahl:</label>
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              class="w-20 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
            />
          </div>
          <div class="text-sm text-gray-500 space-y-0.5">
            <div v-for="(v, idx) in product.variants" :key="idx" :class="{ 'text-[#00af8c] font-medium': idx === activeTierIndex }">
              {{ v.size }}: {{ v.price.toFixed(2) }} €/Stk
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 mb-6">
          <span class="text-2xl font-bold text-[#00af8c]">
            {{ displayPrice.toFixed(2) }}&nbsp;&euro;
          </span>
          <template v-if="product.variants && product.variantType !== 'quantity' && activeVariant">
            <span class="text-sm text-gray-400">
              {{ displayUnitPrice }} €/{{ activeVariant.referenceUnit }}
            </span>
          </template>
          <span v-else-if="product.variantType === 'quantity'" class="text-sm text-gray-400">
            {{ quantity }} × {{ activeTierPrice.toFixed(2) }} €
          </span>
          <span v-else-if="product.unit" class="text-sm text-gray-400">/ {{ product.unit }}</span>
        </div>

        <KoopButton @click="handleAdd">
          In den Warenkorb
        </KoopButton>
      </div>
    </div>

    <!-- Zusätzliche Informationen -->
    <div v-if="product.content || product.details" class="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div v-if="product.content">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Anwendung</h2>
        <p class="text-sm text-gray-600 leading-relaxed">{{ product.content }}</p>
      </div>
      <div v-if="product.details">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Details &amp; Inhaltsstoffe</h2>
        <p class="text-sm text-gray-600 leading-relaxed">{{ product.details }}</p>
      </div>
    </div>

    <ShopCartButton />
    <ShopCartSidebar />
  </div>
</template>

<script setup lang="ts">
import type { Product, Category } from '~/data/products'
import { unitPrice, findTierIndex } from '~/data/products'

const route = useRoute()
const { data } = await useFetch<{ products: Product[], categories: Category[] }>('/api/products')

// Parse path: /shop/747/bad-reiniger, /shop/747, or /shop/bad-reiniger
const segments = Array.isArray(route.params.path) ? route.params.path : [route.params.path]
let product: Product | undefined

if (segments.length >= 2) {
  // /shop/{id}/{slug} — canonical
  product = data.value?.products.find(p => p.id === segments[0])
} else if (segments.length === 1) {
  const param = segments[0]
  if (/^\d+$/.test(param)) {
    // /shop/{id} — redirect to canonical
    product = data.value?.products.find(p => p.id === param)
    if (product) {
      await navigateTo(`/shop/${product.id}/${product.slug}`, { replace: true })
    }
  } else {
    // /shop/{slug} — redirect to canonical
    product = data.value?.products.find(p => p.slug === param)
    if (product) {
      await navigateTo(`/shop/${product.id}/${product.slug}`, { replace: true })
    }
  }
}

if (!product) {
  navigateTo('/shop')
  throw new Error('Product not found')
}

const categoryName = data.value?.categories.find(c => c.slug === product.category)?.name ?? product.category

useHead({
  title: product.metaTitle
    ? `${product.metaTitle} – Kooperative Dürnau`
    : `${product.name} – Kooperative Dürnau`,
  meta: [
    ...(product.metaDescription ? [{ name: 'description', content: product.metaDescription }] : []),
    ...(product.metaKeywords ? [{ name: 'keywords', content: product.metaKeywords }] : []),
  ],
})

const { addToCart } = useCart()

const selectedVariant = ref(0)
const quantity = ref(1)

const activeVariant = computed(() =>
  product.variants?.[selectedVariant.value],
)

const activeTierIndex = computed(() => {
  if (product.variantType !== 'quantity' || !product.variants) return 0
  return findTierIndex(product.variants, quantity.value)
})

const activeTierPrice = computed(() => {
  if (!product.variants) return product.price
  return product.variants[activeTierIndex.value].price
})

const displayPrice = computed(() => {
  if (product.variantType === 'quantity') {
    return activeTierPrice.value * quantity.value
  }
  return activeVariant.value?.price ?? product.price
})

const displayUnitPrice = computed(() =>
  activeVariant.value ? unitPrice(activeVariant.value).toFixed(2) : '',
)

const displayImages = computed(() =>
  activeVariant.value && product.variantType !== 'quantity'
    ? [activeVariant.value.image]
    : product.images,
)

function handleAdd() {
  if (product.variantType === 'quantity') {
    addToCart(product, activeTierIndex.value, quantity.value)
  } else {
    addToCart(product, product.variants ? selectedVariant.value : undefined)
  }
}
</script>
