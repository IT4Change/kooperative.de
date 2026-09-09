<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-24 pb-12 sm:px-6">
    <NuxtLink
      to="/shop"
      class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#00af8c] mb-6"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Zurück zum Shop
    </NuxtLink>

    <ShopProductDetail :product="product" :category-name="categoryName" />

    <ShopCartButton />
    <ShopCartSidebar />
  </div>
</template>

<script setup lang="ts">
  import type { Product } from '~/data/products'

  const route = useRoute()

  // Parse path: /shop/747/bad-reiniger, /shop/747, or /shop/bad-reiniger.
  // The first segment identifies the product in every shape — as id or as slug.
  // A catch-all route always hands over an array, and /shop itself is served by
  // index.vue, so there is always at least one segment to read.
  const segments = route.params.path as string[]
  const productRef = segments[0]

  // One product instead of the whole catalogue: the listing endpoint carries
  // every product, which is far too much to ship for a single detail view.
  const { data } = await useFetch<{ product: Product; categoryName: string }>(
    `/api/products/${encodeURIComponent(productRef)}`,
    { key: `product-${productRef}` },
  )

  const product = data.value?.product
  if (!product) {
    void navigateTo('/shop')
    throw new Error('Product not found')
  }

  // /shop/{id} and /shop/{slug} are aliases — send them to the canonical URL.
  if (segments.length === 1) {
    await navigateTo(`/shop/${product.id}/${product.slug}`, { replace: true })
  }

  const categoryName = data.value?.categoryName ?? product.category

  useHead({
    title: product.metaTitle
      ? `${product.metaTitle} – Kooperative Dürnau`
      : `${product.name} – Kooperative Dürnau`,
    meta: [
      ...(product.metaDescription
        ? [{ name: 'description', content: product.metaDescription }]
        : []),
      ...(product.metaKeywords ? [{ name: 'keywords', content: product.metaKeywords }] : []),
    ],
  })

  // Increment products_viewed counter once per page mount, like the alt-shop does
  // (product_info.php:103). Best-effort — failure must not affect the page.
  onMounted(() => {
    $fetch(`/api/products/${product.id}/view`, { method: 'POST' }).catch(() => {})
  })
</script>
