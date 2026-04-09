<template>
  <div class="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
    <NuxtLink :to="`/shop/${product.id}`">
      <ShopProductGallery :images="displayImages" />
    </NuxtLink>
    <div class="p-5 flex flex-col flex-1">
      <NuxtLink :to="`/shop/${product.id}`" class="hover:text-[#00af8c] transition-colors">
        <h3 class="text-base font-semibold text-gray-900 mb-1">{{ product.name }}</h3>
      </NuxtLink>
      <NuxtLink :to="`/shop/${product.id}`" class="block mb-3 flex-1">
        <p class="text-sm text-gray-500 line-clamp-5">{{ product.description }}</p>
      </NuxtLink>

      <!-- Size variants: dropdown -->
      <div v-if="product.variants && product.variantType !== 'quantity'" class="mb-3">
        <select
          v-model.number="selectedVariant"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00af8c] focus:border-[#00af8c]"
        >
          <option v-for="(v, idx) in product.variants" :key="idx" :value="idx">
            {{ v.size }} · {{ unitPrice(v).toFixed(2) }} €/{{ v.referenceUnit }}
          </option>
        </select>
      </div>

      <!-- Quantity tiers: quantity input + tier info side by side -->
      <div v-else-if="product.variantType === 'quantity' && product.variants" class="mb-3 flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <label class="text-xs text-gray-500">Anz.</label>
          <input
            v-model.number="quantity"
            type="number"
            min="1"
            class="w-16 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00af8c] focus:border-[#00af8c]"
          />
        </div>
        <div class="flex flex-col text-xs text-gray-400 text-right ml-auto">
          <span v-for="(v, idx) in product.variants" :key="idx" :class="{ 'text-[#00af8c] font-medium': idx === activeTierIndex }">
            {{ v.size }}: {{ v.price.toFixed(2) }} €
          </span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <span class="text-lg font-bold text-[#00af8c]">
            {{ displayPrice.toFixed(2) }}&nbsp;€
          </span>
          <span v-if="product.variants && product.variantType !== 'quantity'" class="block text-xs text-gray-400">
            {{ displayUnitPrice }} €/{{ activeVariant!.referenceUnit }}
          </span>
          <span v-else-if="product.variantType === 'quantity'" class="block text-xs text-gray-400">
            {{ quantity }} × {{ activeTierPrice.toFixed(2) }} €
          </span>
          <span v-else-if="product.unit" class="text-xs font-normal text-gray-400">/ {{ product.unit }}</span>
        </div>
        <KoopButton size="sm" @click="handleAdd">
          In den Warenkorb
        </KoopButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/data/products'
import { unitPrice, findTierIndex } from '~/data/products'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  add: [product: Product, variantIndex?: number, quantity?: number]
}>()

const selectedVariant = ref(0)
const quantity = ref(1)

const activeVariant = computed(() =>
  props.product.variants?.[selectedVariant.value],
)

const activeTierIndex = computed(() => {
  if (props.product.variantType !== 'quantity' || !props.product.variants) return 0
  return findTierIndex(props.product.variants, quantity.value)
})

const activeTierPrice = computed(() => {
  if (!props.product.variants) return props.product.price
  return props.product.variants[activeTierIndex.value].price
})

const displayPrice = computed(() => {
  if (props.product.variantType === 'quantity') {
    return activeTierPrice.value * quantity.value
  }
  return activeVariant.value?.price ?? props.product.price
})

const displayUnitPrice = computed(() =>
  activeVariant.value ? unitPrice(activeVariant.value).toFixed(2) : '',
)

const displayImages = computed(() =>
  activeVariant.value && props.product.variantType !== 'quantity'
    ? [activeVariant.value.image]
    : props.product.images,
)

function handleAdd() {
  if (props.product.variantType === 'quantity') {
    emit('add', props.product, activeTierIndex.value, quantity.value)
  } else {
    emit('add', props.product, props.product.variants ? selectedVariant.value : undefined)
  }
}
</script>
