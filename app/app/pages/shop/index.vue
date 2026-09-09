<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-32 pb-12 sm:px-6">
    <section class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold mb-2 inline-flex items-center gap-2">
        Unser Sortiment
        <button
          class="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-gray-300 text-gray-400 hover:border-[#00af8c] hover:text-[#00af8c] transition text-sm font-bold leading-none"
          title="Hilfe"
          @click="showWelcome = true"
        >
          ?
        </button>
      </h1>
      <p class="text-gray-500">
        Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr &mdash; direkt von der
        Kooperative.
      </p>
    </section>

    <section class="mb-4">
      <div class="relative">
        <svg
          class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          aria-label="Produkte durchsuchen"
          placeholder="Produkte durchsuchen..."
          class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
        />
      </div>
    </section>

    <section class="mb-6">
      <ShopCategoryFilter
        :selected="selectedCategory"
        :counts="categoryCounts"
        :categories="categories"
        :total="searchFilteredProducts.length"
        @select="selectCategory"
      />
    </section>

    <section>
      <p v-if="filteredProducts.length === 0" class="text-center text-gray-500 py-12">
        Keine Produkte gefunden.
      </p>
      <ShopProductGrid
        v-else
        :products="filteredProducts"
        @add="(p, vi, qty) => addToCart(p, vi, qty)"
      />
      <div v-if="hasMore" class="mt-8 flex flex-col items-center gap-3">
        <!-- Watched by useInfiniteScroll; sits above the button so loading has
             already started by the time the button would come into view. -->
        <div ref="loadMoreSentinel" aria-hidden="true" class="h-px w-full" />
        <KoopButton @click="loadMore">Mehr anzeigen</KoopButton>
      </div>
      <!-- Auto-loading is invisible without sight: announce the new count. -->
      <p v-if="allFilteredProducts.length > 0" role="status" class="sr-only">
        {{ filteredProducts.length }} von {{ allFilteredProducts.length }} Produkten angezeigt
      </p>
    </section>

    <ShopCartButton />
    <ShopCartSidebar />

    <!-- Willkommens-Popup (nur beim ersten Besuch) -->
    <Teleport to="body">
      <div
        v-if="showWelcome"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4"
        @click.self="dismissWelcome"
      >
        <div class="absolute inset-0 bg-black/50" />
        <div
          ref="welcomePanel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`${uid}-welcome-title`"
          tabindex="-1"
          class="relative bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto focus:outline-none"
        >
          <h2 :id="`${uid}-welcome-title`" class="text-xl font-bold mb-6">
            So funktioniert die Bestellung
          </h2>
          <div class="space-y-5">
            <div class="flex gap-4 items-start">
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full bg-[#00af8c]/10 flex items-center justify-center text-[#00af8c] font-bold"
              >
                1
              </div>
              <div>
                <p class="font-semibold text-gray-800">Produkte ausw&auml;hlen</p>
                <p class="text-sm text-gray-500 mt-0.5">
                  St&ouml;bern Sie im Sortiment und setzen Sie die gew&uuml;nschten Artikel auf die
                  Bestell-Liste.
                </p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full bg-[#00af8c]/10 flex items-center justify-center text-[#00af8c] font-bold"
              >
                2
              </div>
              <div>
                <p class="font-semibold text-gray-800">Bestell-Liste pr&uuml;fen</p>
                <p class="text-sm text-gray-500 mt-0.5">
                  Schauen Sie sich die Bestell-Liste an und kontrollieren Sie Ihre Auswahl.
                </p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full bg-[#00af8c]/10 flex items-center justify-center text-[#00af8c] font-bold"
              >
                3
              </div>
              <div>
                <p class="font-semibold text-gray-800">Anmelden oder Konto anlegen</p>
                <p class="text-sm text-gray-500 mt-0.5">
                  Bestandskunden melden sich mit ihrer E-Mail-Adresse und Passwort an. Neukunden
                  legen ein Konto an.
                </p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full bg-[#00af8c]/10 flex items-center justify-center text-[#00af8c] font-bold"
              >
                4
              </div>
              <div>
                <p class="font-semibold text-gray-800">
                  Versand und Zahlung w&auml;hlen, Bestellung absenden
                </p>
                <p class="text-sm text-gray-500 mt-0.5">
                  W&auml;hlen Sie Ihre Versand- und Zahlungsart. Die Bestellung wird per E-Mail an
                  uns geschickt.
                </p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full bg-[#00af8c]/10 flex items-center justify-center text-[#00af8c] font-bold"
              >
                5
              </div>
              <div>
                <p class="font-semibold text-gray-800">Best&auml;tigungs-E-Mail beantworten</p>
                <p class="text-sm text-gray-500 mt-0.5">
                  Wir pr&uuml;fen Ihre Bestellung und senden Ihnen eine E-Mail zur Best&auml;tigung
                  der Bestellung und der Zahlungskonditionen.
                  <strong
                    >Sie senden uns als Best&auml;tigung des Kaufs die E-Mail zur&uuml;ck</strong
                  >
                  &ndash; erst damit kommt der Kaufvertrag zustande.
                </p>
              </div>
            </div>
          </div>
          <p class="mt-5 text-gray-500 text-xs sm:text-sm">
            Kein Online-Payment &mdash; alle Zahlungswege werden separat abgewickelt.
          </p>
          <div class="mt-6 flex justify-center">
            <KoopButton @click="dismissWelcome">Verstanden</KoopButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import type { CategorySlug, Product, Category } from '~/data/products'

  const { data } = await useFetch<{ products: Product[]; categories: Category[] }>('/api/products')
  const products = computed(() => data.value?.products ?? [])
  const categories = computed(() => data.value?.categories ?? [])

  useHead({
    title: 'Shop – Kooperative Dürnau',
    meta: [
      {
        name: 'description',
        content:
          'Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr – direkt von der Kooperative Dürnau.',
      },
    ],
  })

  const showWelcome = ref(false)

  const uid = useId()
  const welcomePanel = ref<HTMLElement>()
  useModal(showWelcome, welcomePanel, dismissWelcome)

  const storage = useStorage()

  onMounted(() => {
    if (!storage.get('shop-welcome-seen')) {
      showWelcome.value = true
    }
  })

  function dismissWelcome() {
    showWelcome.value = false
    storage.set('shop-welcome-seen', '1')
  }

  const route = useRoute()
  const router = useRouter()
  const { addToCart } = useCart()

  const categorySlugs = computed(() => new Set<string>(categories.value.map((c) => c.slug)))
  const categoryNameMap = computed(
    () => new Map(categories.value.map((c) => [c.slug, c.name.toLowerCase()])),
  )

  /** Explicit URL value for "no category filter" — see selectedCategory. */
  const ALL = 'alle'

  function parseCategory(value: unknown): CategorySlug | null {
    if (typeof value === 'string' && categorySlugs.value.has(value)) return value
    return null
  }

  // Search: local ref for immediate input reactivity
  const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')

  function replaceQuery(params: { kategorie?: string | null; q?: string | null }) {
    const query: Record<string, string> = {}
    if (params.kategorie) query.kategorie = params.kategorie
    if (params.q) query.q = params.q
    void router.replace({ path: route.path, query })
  }

  function selectCategory(slug: CategorySlug | null) {
    replaceQuery({ kategorie: slug ?? ALL, q: searchQuery.value || null })
  }

  // A running search covers the whole range: with a category preselected,
  // scoping the search to it would report "nothing found" while matches sit one
  // click away. The category in force when the search started is remembered
  // verbatim, so clearing the search restores it — including the case where the
  // customer had deliberately picked "Alle", and the case of no parameter at
  // all, which brings the default category back.
  let categoryBeforeSearch: string | null = null

  watch(searchQuery, (q, previous) => {
    if (q && !previous) {
      const current = route.query.kategorie
      categoryBeforeSearch = typeof current === 'string' ? current : null
    }
    if (q) {
      replaceQuery({ kategorie: ALL, q })
    } else {
      replaceQuery({ kategorie: categoryBeforeSearch })
      categoryBeforeSearch = null
    }
  })

  // Sync URL → search (back/forward navigation)
  watch(
    () => route.query.q,
    (q) => {
      const val = typeof q === 'string' ? q : ''
      if (searchQuery.value !== val) searchQuery.value = val
    },
  )

  // Products filtered by search only (for category counts)
  const searchFilteredProducts = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return products.value
    return products.value.filter((p) => {
      const catName = categoryNameMap.value.get(p.category) ?? ''
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        catName.includes(q)
      )
    })
  })

  const categoryCounts = computed(() => {
    const counts: Record<string, number> = {}
    for (const p of searchFilteredProducts.value) {
      let slug: string | undefined = p.category
      while (slug) {
        counts[slug] = (counts[slug] || 0) + 1
        const idx = slug.lastIndexOf('/')
        slug = idx === -1 ? undefined : slug.slice(0, idx)
      }
    }
    return counts
  })

  /**
   * Where the shop lands when no category is in the URL: the first category
   * that actually has products, and inside it the first such subcategory.
   * Mirrors what CategoryFilter renders — a category it greys out as empty must
   * not be the one we preselect.
   */
  const defaultCategory = computed<CategorySlug | null>(() => {
    const hasProducts = (slug: string) => (categoryCounts.value[slug] ?? 0) > 0
    const top = categories.value.find((c) => c.parentSlug === null && hasProducts(c.slug))
    if (!top) return null
    const child = categories.value.find((c) => c.parentSlug === top.slug && hasProducts(c.slug))
    return child?.slug ?? top.slug
  })

  /**
   * The URL stays the single source of truth, with one addition: an absent
   * `kategorie` no longer means "everything", it means "the default". "Alle" is
   * therefore an explicit value, so every state remains linkable and a plain
   * /shop link keeps working.
   */
  const selectedCategory = computed(() => {
    if (route.query.kategorie === ALL) return null
    return parseCategory(route.query.kategorie) ?? defaultCategory.value
  })

  const PAGE_SIZE = 24
  const visibleCount = ref(PAGE_SIZE)

  const allFilteredProducts = computed(() => {
    const result = searchFilteredProducts.value
    const sel = selectedCategory.value
    if (!sel) return result
    const prefix = `${sel}/`
    const filtered = result.filter((p) => p.category === sel || p.category.startsWith(prefix))
    // Bücher-Kategorie (inkl. Subkategorien): nach Aufnahmedatum absteigend sortieren
    if (sel === 'buecher' || sel.startsWith('buecher/')) {
      return [...filtered].sort((a, b) => {
        const cmp = (b.dateAdded ?? '').localeCompare(a.dateAdded ?? '')
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name, 'de')
      })
    }
    return filtered
  })

  const filteredProducts = computed(() => allFilteredProducts.value.slice(0, visibleCount.value))
  const hasMore = computed(() => visibleCount.value < allFilteredProducts.value.length)

  function loadMore() {
    visibleCount.value += PAGE_SIZE
  }

  const loadMoreSentinel = ref<HTMLElement>()
  useInfiniteScroll(loadMoreSentinel, loadMore)

  // Reset beim Filtern/Suchen
  watch([selectedCategory, searchQuery], () => {
    visibleCount.value = PAGE_SIZE
  })
</script>
