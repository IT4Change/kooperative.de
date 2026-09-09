<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    <ShopProductGallery :images="displayImages" size="lg" />

    <div class="flex flex-col">
      <span
        class="text-sm font-medium text-[#00af8c] bg-[#00af8c]/10 px-2.5 py-0.5 rounded-full w-fit mb-3"
      >
        {{ categoryName }}
      </span>

      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{{ product.name }}</h1>
      <p v-if="product.model" class="text-xs text-gray-400 mb-2">Art.-Nr. {{ product.model }}</p>
      <p v-if="product.content" class="text-sm text-gray-500 mb-1">{{ product.content }}</p>
      <p v-if="product.details" class="text-sm text-gray-500 mb-1">{{ product.details }}</p>

      <p class="text-gray-600 mb-6 mt-3">{{ product.description }}</p>

      <!-- Size variants: dropdown -->
      <div v-if="product.variants && product.variantType !== 'quantity'" class="mb-4">
        <label :for="`${uid}-variant`" class="block text-sm font-medium text-gray-700 mb-1">
          Gebindegröße
        </label>
        <select
          :id="`${uid}-variant`"
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
          <label :for="`${uid}-quantity`" class="text-sm font-medium text-gray-700">
            Anzahl:
          </label>
          <input
            :id="`${uid}-quantity`"
            v-model.number="quantity"
            type="number"
            min="1"
            class="w-20 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
          />
        </div>
        <div class="text-sm text-gray-500 space-y-0.5">
          <div
            v-for="(v, idx) in product.variants"
            :key="idx"
            :class="{ 'text-[#00af8c] font-medium': idx === activeTierIndex }"
          >
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

      <KoopButton @click="handleAdd"> Auf die Bestellliste </KoopButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Product } from '~/data/products'

  import { unitPrice, findTierIndex } from '~/data/products'

  /**
   * The product page below the "back to the shop" link: gallery, description,
   * the size or quantity picker, and the price that follows whichever is chosen.
   * Fetching, redirecting and the page metadata stay with the route component.
   */
  const props = defineProps<{
    product: Product
    categoryName: string
  }>()

  const uid = useId()
  const { addToCart } = useCart()

  const selectedVariant = ref(0)
  const quantity = ref(1)

  const activeVariant = computed(() => props.product.variants?.[selectedVariant.value])

  // Only read for a quantity-tier product that has its tiers: the template shows
  // it inside the tier list, and activeTierPrice checks first.
  const activeTierIndex = computed(() => findTierIndex(props.product.variants!, quantity.value))

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

  // Shown next to the price for size variants only, where activeVariant is the
  // currently picked one and therefore always set.
  const displayUnitPrice = computed(() => unitPrice(activeVariant.value!).toFixed(2))

  const displayImages = computed(() =>
    activeVariant.value && props.product.variantType !== 'quantity'
      ? [activeVariant.value.image]
      : props.product.images,
  )

  function handleAdd() {
    if (props.product.variantType === 'quantity') {
      addToCart(props.product, activeTierIndex.value, quantity.value)
    } else {
      addToCart(props.product, props.product.variants ? selectedVariant.value : undefined)
    }
  }
</script>
