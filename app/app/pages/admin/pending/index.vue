<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <p class="text-sm text-gray-500">Bestellungen, die auf die Bestätigung des Kunden warten. Sie sind noch nicht in der Shop-Datenbank.</p>
      <span v-if="data" class="text-sm text-gray-500 ml-auto">{{ data.total }} ausstehend</span>
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Fehler beim Laden: {{ error.statusMessage || error.message }}
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <th class="px-4 py-2.5 font-medium">Eingegangen</th>
            <th class="px-4 py-2.5 font-medium">Kunde</th>
            <th class="px-4 py-2.5 font-medium text-right">Positionen</th>
            <th class="px-4 py-2.5 font-medium text-right">Summe</th>
            <th class="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="pending"><td colspan="5" class="px-4 py-8 text-center text-gray-400">Lädt…</td></tr>
          <tr v-else-if="(data?.pending.length ?? 0) === 0"><td colspan="5" class="px-4 py-10 text-center text-gray-400">Keine ausstehenden Bestätigungen. 🎉</td></tr>
          <tr v-for="p in data?.pending ?? []" :key="p.id" class="hover:bg-gray-50 cursor-pointer" @click="goto(p.id)">
            <td class="px-4 py-2.5 whitespace-nowrap text-gray-600">{{ dateTime(p.createdAt) }}</td>
            <td class="px-4 py-2.5">
              <div class="font-medium text-gray-800">{{ p.customerName || '—' }}</div>
              <div class="text-xs text-gray-400">{{ p.email }}</div>
            </td>
            <td class="px-4 py-2.5 text-right font-mono">{{ p.itemCount }}</td>
            <td class="px-4 py-2.5 text-right font-mono tabular-nums">{{ euro(p.total) }}</td>
            <td class="px-4 py-2.5 text-right">
              <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">ausstehend</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Bestätigungen – Admin' })

const { euro, dateTime } = useAdminFormat()
const router = useRouter()

interface PendingRow { id: number, email: string, customerName: string, itemCount: number, total: number, status: string, createdAt: string }
const { data, error, pending } = await useFetch<{ total: number, pending: PendingRow[] }>('/admin/api/pending')

function goto(id: number) {
  router.push(`/admin/pending/${id}`)
}
</script>
