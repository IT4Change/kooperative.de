<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-24 pb-12 sm:px-6">
    <section class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold mb-2">Unser Sortiment</h1>
      <p class="text-gray-500">
        Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr &mdash; direkt von der Kooperative.
      </p>
    </section>

    <section class="mb-4">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Produkte durchsuchen..."
          class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/40 focus:border-[#4a7c59]"
        />
      </div>
    </section>

    <section class="mb-6">
      <ShopCategoryFilter :selected="selectedCategory" :counts="categoryCounts" @select="selectCategory" />
    </section>

    <section>
      <p v-if="filteredProducts.length === 0" class="text-center text-gray-500 py-12">
        Keine Produkte gefunden.
      </p>
      <ShopProductGrid v-else :products="filteredProducts" @add="addToCart" />
    </section>

    <ShopCartButton />
    <ShopCartSidebar />
  </div>
</template>

<script setup lang="ts">
import type { CategorySlug } from '~/data/products'
import { categories, products } from '~/data/products'

useHead({
  title: 'Shop – Kooperative Dürnau',
  meta: [
    {
      name: 'description',
      content: 'Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr – direkt von der Kooperative Dürnau.',
    },
  ],
})

const route = useRoute()
const router = useRouter()
const { addToCart } = useCart()

const categorySlugs = new Set<string>(categories.map(c => c.slug))
const categoryNameMap = new Map(categories.map(c => [c.slug, c.name.toLowerCase()]))

function parseCategory(value: unknown): CategorySlug | null {
  if (typeof value === 'string' && categorySlugs.has(value)) return value as CategorySlug
  return null
}

// Category: URL is the single source of truth
const selectedCategory = computed(() => parseCategory(route.query.kategorie))

// Search: local ref for immediate input reactivity
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')

function replaceQuery(params: { kategorie?: string | null, q?: string | null }) {
  const query: Record<string, string> = {}
  if (params.kategorie) query.kategorie = params.kategorie
  if (params.q) query.q = params.q
  router.replace({ path: route.path, query })
}

function selectCategory(slug: CategorySlug | null) {
  replaceQuery({ kategorie: slug, q: searchQuery.value || null })
}

// Sync search → URL
watch(searchQuery, (q) => {
  replaceQuery({ kategorie: selectedCategory.value, q: q || null })
})

// Sync URL → search (back/forward navigation)
watch(() => route.query.q, (q) => {
  const val = typeof q === 'string' ? q : ''
  if (searchQuery.value !== val) searchQuery.value = val
})

// Products filtered by search only (for category counts)
const searchFilteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return products
  return products.filter((p) => {
    const catName = categoryNameMap.get(p.category) ?? ''
    return p.name.toLowerCase().includes(q)
      || p.description.toLowerCase().includes(q)
      || catName.includes(q)
  })
})

const categoryCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const p of searchFilteredProducts.value) {
    counts[p.category] = (counts[p.category] || 0) + 1
  }
  return counts
})

const filteredProducts = computed(() => {
  const result = searchFilteredProducts.value
  if (!selectedCategory.value) return result
  return result.filter(p => p.category === selectedCategory.value)
})
</script>
