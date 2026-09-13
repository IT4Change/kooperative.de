<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-24 pb-12 sm:px-6">
    <!--
      Looks like a plain text link, but is a 44px touch target: the padding grows
      the hit area, the negative margins take that growth back out of the layout
      so the label stays exactly where it was. 20px of link was below even the
      24px WCAG 2.5.8 asks for, and the inline-text exception does not apply to a
      link standing on its own above the page.

      active: rather than hover: only — a finger has no hover, so without it the
      tap goes unacknowledged.
    -->
    <NuxtLink
      to="/shop"
      class="-mt-3 -ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-gray-500 transition-colors hover:text-[#00af8c] active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00af8c]"
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
