<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-600 max-w-3xl">
      Impressum, Datenschutz, AGB, Widerruf sowie Versand &amp; Zahlung – für den neuen Shop und den
      Altshop (shop.kooperative.de) gemeinsam. Jede Änderung wird als neue Version gespeichert; live
      ist immer genau eine Version pro Seite.
    </p>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Fehler beim Laden: {{ error.statusMessage || error.message }}
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <th class="px-4 py-2.5 font-medium">Seite</th>
            <th class="px-4 py-2.5 font-medium">Live</th>
            <th class="px-4 py-2.5 font-medium text-right">Versionen</th>
            <th class="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in data ?? []" :key="row.slug" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <NuxtLink
                :to="`/admin/legal/${row.slug}`"
                class="font-medium text-gray-800 hover:text-[#00af8c]"
                >{{ row.title }}</NuxtLink
              >
            </td>
            <td class="px-4 py-3 text-gray-600">
              <template v-if="row.live">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 mr-2"
                  >v{{ row.live.versionNo }}</span
                >
                seit {{ dateTime(row.live.activatedAt) }} · {{ row.live.activatedBy }}
              </template>
              <span v-else class="text-red-600"
                >keine Version live – Shops zeigen den Ersatztext</span
              >
            </td>
            <td class="px-4 py-3 text-right font-mono">
              {{ row.versionCount }}
              <span
                v-if="row.hasNewerDraft"
                class="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-amber-100 text-amber-800"
                >Entwurf</span
              >
            </td>
            <td class="px-4 py-3 text-right">
              <NuxtLink
                :to="`/admin/legal/${row.slug}`"
                class="px-3 py-1.5 bg-[#00af8c] text-white rounded text-xs hover:bg-[#009579]"
                >Bearbeiten</NuxtLink
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { LegalSlug } from '~/data/legalPages'

  definePageMeta({ layout: 'admin' })
  useHead({ title: 'Rechtstexte – Admin' })

  interface OverviewRow {
    slug: LegalSlug
    title: string
    versionCount: number
    live: { versionId: number; versionNo: number; activatedBy: string; activatedAt: string } | null
    hasNewerDraft: boolean
  }

  const { dateTime } = useAdminFormat()
  const { data, error } = await useFetch<OverviewRow[]>('/admin/api/legal')
</script>
