<template>
  <div
    class="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden"
    data-testid="product-card"
  >
    <NuxtLink :to="`/shop/${product.id}/${product.slug}`">
      <ShopProductGallery :images="displayImages" />
    </NuxtLink>
    <div class="p-5 flex flex-col flex-1">
      <NuxtLink
        :to="`/shop/${product.id}/${product.slug}`"
        class="hover:text-[#00af8c] transition-colors"
      >
        <h3 class="text-base font-semibold text-gray-900 mb-1">{{ product.name }}</h3>
      </NuxtLink>
      <NuxtLink :to="`/shop/${product.id}/${product.slug}`" class="block mb-3 flex-1">
        <p class="text-sm text-gray-500 line-clamp-5">{{ product.description }}</p>
      </NuxtLink>

      <!-- Size variants: dropdown -->
      <div v-if="product.variants && product.variantType !== 'quantity'" class="mb-3">
        <select
          :id="`${uid}-variant`"
          v-model.number="selectedVariant"
          :aria-label="`Gebindegröße für ${product.name}`"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00af8c] focus:border-[#00af8c]"
        >
          <option v-for="(v, idx) in product.variants" :key="idx" :value="idx">
            {{ v.size }} ≙ {{ unitPrice(v).toFixed(2) }} €/{{ v.referenceUnit }}
          </option>
        </select>
      </div>

      <!-- Quantity tiers: quantity input + tier info side by side -->
      <div
        v-else-if="product.variantType === 'quantity' && product.variants"
        class="mb-3 flex items-center gap-3"
      >
        <div class="flex items-center gap-1.5">
          <label :for="`${uid}-quantity`" class="text-xs text-gray-500">Anz.</label>
          <input
            :id="`${uid}-quantity`"
            v-model.number="quantity"
            type="number"
            min="1"
            class="w-16 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00af8c] focus:border-[#00af8c]"
          />
        </div>
        <div class="flex flex-col text-xs text-gray-400 text-right ml-auto">
          <span
            v-for="(v, idx) in product.variants"
            :key="idx"
            :class="{ 'text-[#00af8c] font-medium': idx === activeTierIndex }"
          >
            {{ v.size }}: {{ v.price.toFixed(2) }} €
          </span>
        </div>
      </div>

      <!-- The button keeps its size across all cards: the price row holds only
           the price and the button, everything the price can carry (unit price,
           tier total, pack size) gets a full-width line of its own below it. -->
      <div class="flex items-center justify-between gap-3">
        <span class="text-lg font-bold text-[#00af8c]" data-testid="product-price">
          {{ displayPrice.toFixed(2) }}&nbsp;€
        </span>
        <KoopButton size="sm" class="shrink-0" @click="handleAdd">
          Auf die Bestellliste
        </KoopButton>
      </div>
      <p v-if="priceNote" class="mt-1 text-xs text-gray-400">{{ priceNote }}</p>
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

  // The grid renders this card many times — ids must not collide.
  const uid = useId()

  const selectedVariant = ref(0)
  const quantity = ref(1)

  const activeVariant = computed(() => props.product.variants?.[selectedVariant.value])

  // Only ever read for a quantity-tier product that has its tiers: the template
  // renders it inside the tier list, and activeTierPrice checks first.
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

  // Shown below the price for size variants only, where activeVariant is the
  // currently picked one and therefore always set.
  const displayUnitPrice = computed(() => unitPrice(activeVariant.value!).toFixed(2))

  /**
   * The line below the price row. Whatever a product carries here — unit price,
   * tier total or the pack size from the catalogue, which is free text and can
   * be as long as "(7,06 EURO pro Kilogramm)" — it must not sit next to the
   * button: that squeezed the button until its label wrapped, and cards ended up
   * with differently sized buttons.
   */
  const priceNote = computed(() => {
    const { variants, variantType, unit } = props.product
    if (variants && variantType !== 'quantity') {
      return `≙ ${displayUnitPrice.value} €/${activeVariant.value!.referenceUnit}`
    }
    if (variantType === 'quantity') {
      return `${quantity.value} × ${activeTierPrice.value.toFixed(2)} €`
    }
    return unit ?? ''
  })

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
