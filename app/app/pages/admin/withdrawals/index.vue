<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-600">
      Über „Vertrag widerrufen“ abgegebene Erklärungen aus beiden Shops (§ 356a BGB). Passen
      Bestellnummer und E-Mail-Adresse zu einer Bestellung, ist sie verknüpft und der Widerruf steht
      auch dort; sonst bitte von Hand zuordnen.
    </p>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Fehler beim Laden: {{ error.statusMessage || error.message }}
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <th class="px-4 py-2.5 font-medium">Eingang</th>
            <th class="px-4 py-2.5 font-medium">Bestellung</th>
            <th class="px-4 py-2.5 font-medium">Name</th>
            <th class="px-4 py-2.5 font-medium">E-Mail</th>
            <th class="px-4 py-2.5 font-medium">Umfang</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="pending">
            <td colspan="5" class="px-4 py-8 text-center text-gray-400">Lädt…</td>
          </tr>
          <tr v-else-if="(data?.withdrawals.length ?? 0) === 0">
            <td colspan="5" class="px-4 py-8 text-center text-gray-400">Keine Widerrufe.</td>
          </tr>
          <tr v-for="w in data?.withdrawals ?? []" :key="w.id" class="align-top hover:bg-gray-50">
            <td class="px-4 py-2.5 whitespace-nowrap">{{ dateTime(w.createdAt) }}</td>
            <td class="px-4 py-2.5">
              <NuxtLink
                v-if="w.ordersId !== null"
                :to="`/admin/orders/${w.ordersId}`"
                class="font-mono text-[#00af8c] hover:underline"
                >#{{ w.ordersId }}</NuxtLink
              >
              <span v-else class="text-amber-700" title="Keine passende Bestellung gefunden"
                >„{{ w.orderRef }}“ – nicht zugeordnet</span
              >
            </td>
            <td class="px-4 py-2.5 text-gray-800">{{ w.name }}</td>
            <td class="px-4 py-2.5">
              <a :href="`mailto:${w.email}`" class="text-[#00af8c] hover:underline">{{
                w.email
              }}</a>
            </td>
            <td class="px-4 py-2.5 text-gray-600">
              {{ w.scope === 'all' ? 'gesamte Bestellung' : 'einzelne Artikel' }}
              <span v-if="w.items" class="block text-xs whitespace-pre-wrap">{{ w.items }}</span>
              <span v-if="w.message" class="block text-xs text-gray-500 whitespace-pre-wrap">{{
                w.message
              }}</span>
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
      <span class="px-2 text-gray-500">Seite {{ page }} / {{ totalPages }}</span>
      <button
        class="px-3 py-1.5 border rounded disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="setPage(page + 1)"
      >
        Weiter ›
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({ layout: 'admin' })
  useHead({ title: 'Widerrufe – Admin' })

  const { dateTime } = useAdminFormat()
  const route = useRoute()
  const router = useRouter()
  const page = computed(() => Math.max(1, Number(route.query.page) || 1))
  const LIMIT = 50

  interface WithdrawalRow {
    id: number
    name: string
    email: string
    orderRef: string
    scope: 'all' | 'partial'
    items: string | null
    message: string | null
    ordersId: number | null
    createdAt: string
  }

  const query = computed(() => ({ page: String(page.value), limit: String(LIMIT) }))
  const { data, error, pending } = await useFetch<{
    total: number
    withdrawals: WithdrawalRow[]
  }>('/admin/api/withdrawals', { query })
  const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / LIMIT)))

  function setPage(p: number) {
    void router.push({ path: '/admin/withdrawals', query: p > 1 ? { page: String(p) } : {} })
  }
</script>
