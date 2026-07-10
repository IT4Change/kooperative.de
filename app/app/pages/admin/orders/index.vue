<template>
  <div class="space-y-4">
    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Suche: Bestell-Nr., Name, E-Mail…"
        class="px-3 py-2 border border-gray-300 rounded text-sm w-72 focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
        @keyup.enter="applyFilters"
      >
      <select
        v-model="statusFilter"
        class="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
        @change="applyFilters"
      >
        <option value="">Alle Status</option>
        <option v-for="s in statusOptions" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </select>
      <button class="px-3 py-2 bg-[#00af8c] text-white rounded text-sm hover:bg-[#009579]" @click="applyFilters">Filtern</button>
      <span v-if="data" class="text-sm text-gray-500 ml-auto">{{ data.total.toLocaleString('de-DE') }} Bestellungen</span>
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
            <th class="px-4 py-2.5 font-medium">Zahlung</th>
            <th class="px-4 py-2.5 font-medium text-right">Summe</th>
            <th class="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="pending">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">Lädt…</td>
          </tr>
          <tr v-else-if="(data?.orders.length ?? 0) === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">Keine Bestellungen gefunden.</td>
          </tr>
          <tr
            v-for="o in data?.orders ?? []"
            :key="o.id"
            class="hover:bg-gray-50 cursor-pointer"
            @click="goto(o.id)"
          >
            <td class="px-4 py-2.5 font-mono">{{ o.id }}</td>
            <td class="px-4 py-2.5 whitespace-nowrap text-gray-600">{{ dateTime(o.datePurchased) }}</td>
            <td class="px-4 py-2.5">
              <div class="font-medium text-gray-800">{{ o.customerName || '—' }}</div>
              <div class="text-xs text-gray-400">{{ o.email }}</div>
            </td>
            <td class="px-4 py-2.5 text-gray-600">{{ o.paymentMethod }}</td>
            <td class="px-4 py-2.5 text-right font-mono tabular-nums">{{ euro(o.total) }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(o.statusId)">
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

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const statusFilter = ref(typeof route.query.status === 'string' ? route.query.status : '')
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const LIMIT = 50

interface OrderRow {
  id: number, customerName: string, email: string, datePurchased: string,
  statusId: number, statusName: string | null, paymentMethod: string, total: number | null
}
interface OrderList { total: number, page: number, limit: number, orders: OrderRow[] }

const query = computed(() => ({
  q: route.query.q || '',
  status: route.query.status || '',
  page: String(page.value),
  limit: String(LIMIT),
}))

const { data, error, pending } = await useFetch<OrderList>('/admin/api/orders', { query })

// status options for the filter dropdown (from dashboard endpoint)
const { data: dash } = await useFetch<{ statuses: { id: number, name: string }[] }>('/admin/api/dashboard')
const statusOptions = computed(() => dash.value?.statuses ?? [])

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / LIMIT)))

function applyFilters() {
  router.push({ path: '/admin/orders', query: pruned({ q: search.value || undefined, status: statusFilter.value || undefined }) })
}
function setPage(p: number) {
  router.push({ path: '/admin/orders', query: pruned({ ...route.query, page: p > 1 ? String(p) : undefined }) })
}
function pruned(q: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) if (v != null && v !== '') out[k] = String(v)
  return out
}
function goto(id: number) {
  router.push(`/admin/orders/${id}`)
}
</script>
