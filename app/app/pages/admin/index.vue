<template>
  <div class="space-y-6">
    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Daten konnten nicht geladen werden: {{ error.statusMessage || error.message }}
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Bestellungen -->
      <section class="bg-white rounded-lg shadow-sm border border-gray-200">
        <header class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 class="font-semibold text-gray-800">Bestellungen</h2>
          <NuxtLink to="/admin/orders" class="text-sm text-[#00af8c] hover:underline">Alle ansehen →</NuxtLink>
        </header>
        <ul class="divide-y divide-gray-100">
          <li v-for="s in data?.statuses ?? []" :key="s.id">
            <NuxtLink :to="`/admin/orders?status=${s.id}`" class="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <span class="flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full" :class="statusClass(s.id)" />
                {{ s.name }}
              </span>
              <span class="font-mono font-semibold tabular-nums">{{ s.count.toLocaleString('de-DE') }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Statistik -->
      <section class="bg-white rounded-lg shadow-sm border border-gray-200">
        <header class="px-5 py-3 border-b border-gray-100">
          <h2 class="font-semibold text-gray-800">Statistik</h2>
        </header>
        <ul class="divide-y divide-gray-100">
          <li class="flex items-center justify-between px-5 py-3">
            <NuxtLink to="/admin/customers" class="hover:underline text-gray-700">Kunden</NuxtLink>
            <span class="font-mono font-semibold tabular-nums">{{ (data?.stats.customers ?? 0).toLocaleString('de-DE') }}</span>
          </li>
          <li class="flex items-center justify-between px-5 py-3">
            <span class="text-gray-700">Produkte (aktiv)</span>
            <span class="font-mono font-semibold tabular-nums">{{ (data?.stats.productsActive ?? 0).toLocaleString('de-DE') }}</span>
          </li>
          <li class="flex items-center justify-between px-5 py-3">
            <span class="text-gray-700">Bewertungen</span>
            <span class="font-mono font-semibold tabular-nums">{{ (data?.stats.reviews ?? 0).toLocaleString('de-DE') }}</span>
          </li>
        </ul>
      </section>
    </div>

    <p class="text-xs text-gray-400">
      Zahlen aus der gemeinsamen Shop-Datenbank (alter + neuer Shop). Read-only.
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Übersicht – Admin' })

const { statusClass } = useAdminFormat()

interface Dashboard {
  statuses: { id: number, name: string, count: number }[]
  stats: { customers: number, productsActive: number, reviews: number }
}
const { data, error } = await useFetch<Dashboard>('/admin/api/dashboard')
</script>
