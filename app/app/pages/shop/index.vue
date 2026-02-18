<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-24 pb-12 sm:px-6">
    <section class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold mb-2">Unser Sortiment</h1>
      <p class="text-gray-500">
        Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr &mdash; direkt von der Kooperative.
      </p>
    </section>

    <section class="mb-6">
      <ShopCategoryFilter :selected="selectedCategory" @select="selectedCategory = $event" />
    </section>

    <section>
      <ShopProductGrid :products="filteredProducts" @add="addToCart" />
    </section>

    <ShopCartButton />
    <ShopCartSidebar />
  </div>
</template>

<script setup lang="ts">
import type { CategorySlug } from '~/data/products'
import { products } from '~/data/products'

useHead({
  title: 'Shop – Kooperative Dürnau',
  meta: [
    {
      name: 'description',
      content: 'Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr – direkt von der Kooperative Dürnau.',
    },
  ],
})

const selectedCategory = ref<CategorySlug | null>(null)
const { addToCart } = useCart()

const filteredProducts = computed(() => {
  if (!selectedCategory.value) return products
  return products.filter(p => p.category === selectedCategory.value)
})
</script>
