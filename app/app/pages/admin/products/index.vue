<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        aria-label="Produkte durchsuchen"
        placeholder="Suche: Nr., Name, Modell…"
        class="px-3 py-2 border border-gray-300 rounded text-sm w-72 focus:outline-none focus:ring-2 focus:ring-koop-blue/40 focus:border-koop-blue"
        @keyup.enter="pushQuery()"
      />
      <button
        class="px-3 py-2 bg-koop-blue text-white rounded text-sm hover:bg-koop-blue-hover"
        @click="pushQuery()"
      >
        Suchen
      </button>
      <label class="flex items-center gap-1.5 text-sm text-koop-ink-muted cursor-pointer">
        <input
          type="checkbox"
          :checked="onlyActive"
          class="rounded border-gray-300 text-koop-blue focus:ring-koop-blue"
          @change="toggleActive"
        />
        nur aktive
      </label>
      <span v-if="data" class="text-sm text-koop-ink-muted ml-auto"
        >{{ data.total.toLocaleString('de-DE') }} Produkte</span
      >
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Fehler beim Laden: {{ error.statusMessage || error.message }}
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left text-koop-ink-muted border-b border-gray-200">
            <th class="px-4 py-2.5 font-medium">Nr.</th>
            <th class="px-4 py-2.5 font-medium">Modell</th>
            <th class="px-4 py-2.5 font-medium">Name</th>
            <th class="px-4 py-2.5 font-medium text-right">Preis (netto)</th>
            <th class="px-4 py-2.5 font-medium text-right">Verkauft</th>
            <th class="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="pending">
            <td colspan="6" class="px-4 py-8 text-center text-koop-ink-muted">Lädt…</td>
          </tr>
          <tr v-else-if="(data?.products.length ?? 0) === 0">
            <td colspan="6" class="px-4 py-8 text-center text-koop-ink-muted">
              Keine Produkte gefunden.
            </td>
          </tr>
          <tr v-for="p in data?.products ?? []" :key="p.id" class="hover:bg-gray-50">
            <td class="px-4 py-2.5 font-mono text-koop-ink-muted">{{ p.id }}</td>
            <td class="px-4 py-2.5 font-mono text-koop-ink-muted">{{ p.model || '–' }}</td>
            <td class="px-4 py-2.5 text-koop-ink">{{ p.name }}</td>
            <td class="px-4 py-2.5 text-right font-mono tabular-nums">{{ euro(p.price) }}</td>
            <td class="px-4 py-2.5 text-right font-mono">
              {{ p.ordered.toLocaleString('de-DE') }}
            </td>
            <td class="px-4 py-2.5">
              <span
                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                :class="
                  p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-koop-ink-muted'
                "
              >
                {{ p.active ? 'aktiv' : 'inaktiv' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 text-sm">
      <button
        class="px-3 py-1.5 border rounded disabled:opacity-40"
        :disabled="page <= 1"
        @click="setPage(page - 1)"
      >
        ‹ Zurück
      </button>
      <span class="px-2 text-koop-ink-muted">Seite {{ page }} / {{ totalPages }}</span>
      <button
        class="px-3 py-1.5 border rounded disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="setPage(page + 1)"
      >
        Weiter ›
      </button>
    </div>

    <p class="text-xs text-koop-ink-muted">Read-only – Anzeige aus der Shop-Datenbank.</p>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({ layout: 'admin' })
  useHead({ title: 'Produkte – Admin' })

  const { euro } = useAdminFormat()
  const route = useRoute()
  const router = useRouter()

  const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
  const onlyActive = computed(() => route.query.active === '1')
  const page = computed(() => Math.max(1, Number(route.query.page) || 1))
  const LIMIT = 50

  interface ProductRow {
    id: number
    model: string
    name: string
    price: number | null
    active: boolean
    ordered: number
    quantity: number
  }
  interface ProductList {
    total: number
    page: number
    limit: number
    products: ProductRow[]
  }

  const apiQuery = computed(() => ({
    q: route.query.q || '',
    active: route.query.active || '',
    page: String(page.value),
    limit: String(LIMIT),
  }))
  const { data, error, pending } = await useFetch<ProductList>('/admin/api/products', {
    query: apiQuery,
  })
  const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / LIMIT)))

  function pushQuery(over: Record<string, string | undefined> = {}) {
    const query = prune({
      q: search.value || undefined,
      active: onlyActive.value ? '1' : undefined,
      ...over,
    })
    void router.push({ path: '/admin/products', query })
  }
  function toggleActive() {
    pushQuery({ active: onlyActive.value ? undefined : '1' })
  }
  function setPage(p: number) {
    pushQuery({ page: p > 1 ? String(p) : undefined })
  }
  function prune(q: Record<string, string | undefined>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(q)) if (v != null && v !== '') out[k] = v
    return out
  }
</script>
