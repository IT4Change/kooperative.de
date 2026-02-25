<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-32 pb-12 sm:px-6">
    <section class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold mb-2 inline-flex items-center gap-2">
        Unser Sortiment
        <button @click="showWelcome = true" class="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-gray-300 text-gray-400 hover:border-[#4a7c59] hover:text-[#4a7c59] transition text-sm font-bold leading-none" title="Hilfe">?</button>
      </h1>
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

    <!-- Willkommens-Popup (nur beim ersten Besuch) -->
    <Teleport to="body">
      <div v-if="showWelcome" class="fixed inset-0 z-[200] flex items-center justify-center p-4" @click.self="dismissWelcome">
        <div class="absolute inset-0 bg-black/50" />
        <div class="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 sm:p-8">
          <h2 class="text-xl font-bold mb-6">So funktioniert die Bestellung</h2>
          <div class="space-y-5">
            <div class="flex gap-4 items-start">
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-[#4a7c59]/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-[#4a7c59]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-gray-800">1. Produkte ausw&auml;hlen</p>
                <p class="text-sm text-gray-500 mt-0.5">St&ouml;bern Sie im Sortiment und legen Sie Artikel in den Warenkorb.</p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-[#4a7c59]/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-[#4a7c59]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-gray-800">2. Warenkorb pr&uuml;fen</p>
                <p class="text-sm text-gray-500 mt-0.5">&Ouml;ffnen Sie den Warenkorb und kontrollieren Sie Ihre Auswahl.</p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-[#4a7c59]/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-[#4a7c59]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-gray-800">3. Bestellung absenden</p>
                <p class="text-sm text-gray-500 mt-0.5">F&uuml;llen Sie das Formular aus. Die Bestellung wird per E-Mail an uns geschickt.</p>
              </div>
            </div>
          </div>
          <p class="mt-4 text-gray-500 text-xs sm:text-sm">Kein Online-Payment &mdash; die Bezahlung erfolgt bei Abholung oder auf Rechnung.</p>
          <button class="mt-6 w-full py-2.5 bg-[#4a7c59] hover:bg-[#3d6a4a] text-white font-semibold rounded-lg transition" @click="dismissWelcome">
            Verstanden
          </button>
        </div>
      </div>
    </Teleport>
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

const showWelcome = ref(false)

onMounted(() => {
  if (!localStorage.getItem('shop-welcome-seen')) {
    showWelcome.value = true
  }
})

function dismissWelcome() {
  showWelcome.value = false
  localStorage.setItem('shop-welcome-seen', '1')
}

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
