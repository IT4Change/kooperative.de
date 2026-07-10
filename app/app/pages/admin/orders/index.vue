<template>
  <div class="space-y-4">
    <!-- Search -->
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Suche: Bestell-Nr., Name, E-Mail…"
        class="px-3 py-2 border border-gray-300 rounded text-sm w-72 focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
        @keyup.enter="pushQuery()"
      >
      <button class="px-3 py-2 bg-[#00af8c] text-white rounded text-sm hover:bg-[#009579]" @click="pushQuery()">Suchen</button>
      <span v-if="data" class="text-sm text-gray-500 ml-auto">{{ data.total.toLocaleString('de-DE') }} Bestellungen</span>
    </div>

    <!-- Status filter (combinable checkboxes) -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm">
      <span class="text-gray-500 font-medium">Status:</span>
      <label v-for="s in STATUS_ORDER" :key="s.key" class="flex items-center gap-1.5 cursor-pointer select-none">
        <input type="checkbox" :checked="selected.includes(s.key)" class="rounded border-gray-300 text-[#00af8c] focus:ring-[#00af8c]" @change="toggle(s.key)">
        <span :class="selected.includes(s.key) ? 'text-gray-800' : 'text-gray-500'">{{ s.label }}</span>
      </label>
      <span class="ml-auto flex items-center gap-3">
        <button class="text-[#00af8c] hover:underline" @click="setKeys(ALL_KEYS)">Alle anzeigen</button>
        <button class="text-gray-500 hover:underline" @click="setKeys(DEFAULT_KEYS)">Standard</button>
      </span>
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Fehler beim Laden: {{ error.statusMessage || error.message }}
    </div>

    <!-- Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <th class="px-4 py-2.5 font-medium">Nr.</th>
            <th class="px-4 py-2.5 font-medium">Datum</th>
            <th class="px-4 py-2.5 font-medium">Kunde</th>
            <th class="px-4 py-2.5 font-medium">Herkunft</th>
            <th class="px-4 py-2.5 font-medium">Zahlung</th>
            <th class="px-4 py-2.5 font-medium text-right">Summe</th>
            <th class="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="pending">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400">Lädt…</td>
          </tr>
          <tr v-else-if="(data?.orders.length ?? 0) === 0">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400">Keine Bestellungen gefunden.</td>
          </tr>
          <tr
            v-for="o in data?.orders ?? []"
            :key="o.kind + o.id"
            class="hover:bg-gray-50 cursor-pointer"
            @click="goto(o)"
          >
            <td class="px-4 py-2.5 font-mono">
              <span v-if="o.kind === 'order'">{{ o.id }}</span>
              <span v-else class="text-gray-400" title="Noch keine Bestell-Nr. (unbestätigt)">—</span>
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap text-gray-600">{{ dateTime(o.datePurchased) }}</td>
            <td class="px-4 py-2.5">
              <div class="font-medium text-gray-800">{{ o.customerName || '—' }}</div>
              <div class="text-xs text-gray-400">{{ o.email }}</div>
            </td>
            <td class="px-4 py-2.5">
              <span
                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                :class="o.origin === 'neu' ? 'bg-[#00af8c]/10 text-[#00838a]' : 'bg-gray-100 text-gray-500'"
              >
                {{ o.origin === 'neu' ? 'Neuer Shop' : 'Alter Shop' }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-gray-600">{{ o.paymentMethod }}</td>
            <td class="px-4 py-2.5 text-right font-mono tabular-nums">{{ euro(o.total) }}</td>
            <td class="px-4 py-2.5">
              <span
                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                :class="o.kind === 'pending' ? 'bg-amber-100 text-amber-800' : statusClass(o.statusId)"
              >
                {{ o.statusName || `Status ${o.statusId}` }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 text-sm">
      <button class="px-3 py-1.5 border rounded disabled:opacity-40" :disabled="page <= 1" @click="setPage(page - 1)">‹ Zurück</button>
      <span class="px-2 text-gray-500">Seite {{ page }} / {{ totalPages }}</span>
      <button class="px-3 py-1.5 border rounded disabled:opacity-40" :disabled="page >= totalPages" @click="setPage(page + 1)">Weiter ›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Bestellungen – Admin' })

const { euro, dateTime, statusClass } = useAdminFormat()
const route = useRoute()
const router = useRouter()

const STATUS_ORDER = [
  { key: 'pending', label: 'Bestätigung ausstehend' },
  { key: '1', label: 'In Bearbeitung' },
  { key: '4', label: 'Vorkasse erwartet' },
  { key: '2', label: 'Versandbereit' },
  { key: '3', label: 'Versendet' },
]
const ALL_KEYS = STATUS_ORDER.map(s => s.key)
const DEFAULT_KEYS = ['pending', '1', '4', '2'] // hides completed (Versendet)
const LIMIT = 50

function parseSelected(): string[] {
  const raw = route.query.status
  if (raw === undefined) return [...DEFAULT_KEYS]
  if (raw === 'all') return [...ALL_KEYS]
  if (raw === 'none') return []
  return String(raw).split(',').filter(k => ALL_KEYS.includes(k))
}
const selected = ref<string[]>(parseSelected())
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

function statusValue(sel: string[]): string {
  if (sel.length === ALL_KEYS.length) return 'all'
  if (sel.length === 0) return 'none'
  return sel.join(',')
}

interface OrderRow {
  kind: 'order' | 'pending', id: number, customerName: string, email: string, datePurchased: string,
  statusId: number, statusName: string | null, paymentMethod: string, total: number | null, origin: 'alt' | 'neu'
}
interface OrderList { total: number, page: number, limit: number, orders: OrderRow[] }

const apiQuery = computed(() => ({
  q: route.query.q || '',
  status: route.query.status ?? '',
  page: String(page.value),
  limit: String(LIMIT),
}))
const { data, error, pending } = await useFetch<OrderList>('/admin/api/orders', { query: apiQuery })
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / LIMIT)))

// Keep the URL (and thus the fetch) in sync with the current search + status selection.
function pushQuery(over: Record<string, string | undefined> = {}) {
  const query = prune({
    q: search.value || undefined,
    status: statusValue(selected.value),
    ...over,
  })
  router.push({ path: '/admin/orders', query })
}
function toggle(key: string) {
  const i = selected.value.indexOf(key)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(key)
  pushQuery()
}
function setKeys(keys: string[]) {
  selected.value = [...keys]
  pushQuery()
}
function setPage(p: number) {
  pushQuery({ page: p > 1 ? String(p) : undefined })
}
function prune(q: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) if (v != null && v !== '') out[k] = String(v)
  return out
}
function goto(o: OrderRow) {
  router.push(o.kind === 'pending' ? `/admin/pending/${o.id}` : `/admin/orders/${o.id}`)
}
</script>
