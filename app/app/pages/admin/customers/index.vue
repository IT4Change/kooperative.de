<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Suche: Kunden-Nr., Name, E-Mail…"
        class="px-3 py-2 border border-gray-300 rounded text-sm w-72 focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
        @keyup.enter="applyFilters"
      >
      <button class="px-3 py-2 bg-[#00af8c] text-white rounded text-sm hover:bg-[#009579]" @click="applyFilters">Suchen</button>
      <span v-if="data" class="text-sm text-gray-500 ml-auto">{{ data.total.toLocaleString('de-DE') }} Kunden</span>
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Fehler beim Laden: {{ error.statusMessage || error.message }}
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <th class="px-4 py-2.5 font-medium">Nr.</th>
            <th class="px-4 py-2.5 font-medium">Name</th>
            <th class="px-4 py-2.5 font-medium">E-Mail</th>
            <th class="px-4 py-2.5 font-medium">Telefon</th>
            <th class="px-4 py-2.5 font-medium">Ort</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="pending"><td colspan="5" class="px-4 py-8 text-center text-gray-400">Lädt…</td></tr>
          <tr v-else-if="(data?.customers.length ?? 0) === 0"><td colspan="5" class="px-4 py-8 text-center text-gray-400">Keine Kunden gefunden.</td></tr>
          <tr v-for="c in data?.customers ?? []" :key="c.id" class="hover:bg-gray-50">
            <td class="px-4 py-2.5 font-mono">{{ c.id }}</td>
            <td class="px-4 py-2.5 text-gray-800">{{ c.name || '—' }}</td>
            <td class="px-4 py-2.5"><a :href="`mailto:${c.email}`" class="text-[#00af8c] hover:underline">{{ c.email }}</a></td>
            <td class="px-4 py-2.5 text-gray-600">{{ c.telephone || '–' }}</td>
            <td class="px-4 py-2.5 text-gray-600">{{ c.city || '–' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 text-sm">
      <button class="px-3 py-1.5 border rounded disabled:opacity-40" :disabled="page <= 1" @click="setPage(page - 1)">‹ Zurück</button>
      <span class="px-2 text-gray-500">Seite {{ page }} / {{ totalPages }}</span>
      <button class="px-3 py-1.5 border rounded disabled:opacity-40" :disabled="page >= totalPages" @click="setPage(page + 1)">Weiter ›</button>
    </div>

    <p class="text-xs text-gray-400">Read-only. Bearbeitung folgt in einer späteren Phase.</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Kunden – Admin' })

const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const LIMIT = 50

interface CustomerRow { id: number, name: string, email: string, telephone: string, city: string }
interface CustomerList { total: number, page: number, limit: number, customers: CustomerRow[] }

const query = computed(() => ({ q: route.query.q || '', page: String(page.value), limit: String(LIMIT) }))
const { data, error, pending } = await useFetch<CustomerList>('/admin/api/customers', { query })
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / LIMIT)))

function applyFilters() {
  router.push({ path: '/admin/customers', query: search.value ? { q: search.value } : {} })
}
function setPage(p: number) {
  const q: Record<string, string> = {}
  if (search.value) q.q = search.value
  if (p > 1) q.page = String(p)
  router.push({ path: '/admin/customers', query: q })
}
</script>
