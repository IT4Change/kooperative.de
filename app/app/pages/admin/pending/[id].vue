<template>
  <div class="space-y-6">
    <NuxtLink to="/admin/orders?status=pending" class="text-sm text-[#00af8c] hover:underline">‹ Zurück zur Liste</NuxtLink>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      {{ error.statusCode === 404 ? 'Vorgang nicht gefunden.' : (error.statusMessage || error.message) }}
    </div>

    <template v-if="data">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-xl font-bold text-gray-800">Bestellung</h2>
        <span class="text-sm text-gray-400">noch keine Bestell-Nr.</span>
        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium" :class="statusBadge">{{ statusLabel }}</span>
        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#00af8c]/10 text-[#00838a]">Neuer Shop</span>
        <span class="text-sm text-gray-500 ml-auto">{{ dateTime(data.pending.createdAt) }}</span>
      </div>

      <!-- Status graphic -->
      <section v-if="data.pending.status !== 'cancelled'" class="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-5">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Bestellprozess</h3>
        <div class="flex items-start">
          <template v-for="(s, i) in data.statusFlow" :key="s.id">
            <div class="flex flex-col items-center text-center w-24 shrink-0">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition" :class="circleClass(s.state)">
                <svg v-if="s.state === 'done'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                <span v-else>{{ i + 1 }}</span>
              </div>
              <span class="text-xs mt-2 leading-tight" :class="s.state === 'upcoming' ? 'text-gray-400' : 'text-gray-800 font-medium'">{{ s.name }}</span>
              <span v-if="s.visitedAt && s.state !== 'upcoming'" class="text-[10px] text-gray-400 mt-0.5">{{ date(s.visitedAt) }}</span>
            </div>
            <div v-if="i < data.statusFlow.length - 1" class="flex-1 h-0.5 mt-5 rounded" :class="s.state === 'done' ? 'bg-[#00af8c]' : 'bg-gray-200'" />
          </template>
        </div>
        <p class="mt-4 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Diese Bestellung wartet auf die Bestätigung des Kunden (Link oder Antwort-Mail). Erst danach wird sie als Bestellung mit Nummer angelegt.
        </p>
      </section>

      <div v-if="data.pending.status === 'materialized' && data.pending.ordersId" class="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
        Bestätigt ({{ viaLabel(data.pending.confirmedVia) }}) und als Bestellung angelegt.
        <NuxtLink :to="`/admin/orders/${data.pending.ordersId}`" class="font-medium underline">Zur Bestellung #{{ data.pending.ordersId }} →</NuxtLink>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-6">
          <section class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Positionen</header>
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 text-left text-gray-500">
                  <th class="px-4 py-2 font-medium">Artikel</th>
                  <th class="px-4 py-2 font-medium text-right">Menge</th>
                  <th class="px-4 py-2 font-medium text-right">Einzel</th>
                  <th class="px-4 py-2 font-medium text-right">Summe</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(it, i) in data.items" :key="i">
                  <td class="px-4 py-2.5 text-gray-800">{{ it.name }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ it.quantity }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ euro(it.unitPrice) }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ euro(it.lineTotal) }}</td>
                </tr>
              </tbody>
              <tfoot class="border-t border-gray-200">
                <tr><td colspan="3" class="px-4 py-1.5 text-right text-gray-600">Zwischensumme</td><td class="px-4 py-1.5 text-right font-mono">{{ euro(data.subtotal) }}</td></tr>
                <tr><td colspan="3" class="px-4 py-1.5 text-right text-gray-600">Versand ({{ data.shipping.label }})</td><td class="px-4 py-1.5 text-right font-mono">{{ data.shipping.price > 0 ? euro(data.shipping.price) : 'nach Aufwand' }}</td></tr>
                <tr v-for="(t, i) in data.taxRows" :key="i"><td colspan="3" class="px-4 py-1.5 text-right text-gray-500">{{ t.description }}</td><td class="px-4 py-1.5 text-right font-mono text-gray-500">{{ euro(t.total) }}</td></tr>
                <tr><td colspan="3" class="px-4 py-2 text-right font-bold">Gesamt</td><td class="px-4 py-2 text-right font-mono font-bold">{{ euro(data.total) }}</td></tr>
              </tfoot>
            </table>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Gesendete E-Mails</header>
            <ul class="divide-y divide-gray-100">
              <li v-for="m in data.mails" :key="m.id" class="px-5 py-3 flex items-start gap-3">
                <span class="shrink-0 mt-0.5 text-gray-400">{{ m.direction === 'to_customer' ? '→ Kunde' : '→ Admin' }}</span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-gray-800">{{ m.subject }}</div>
                  <div class="text-xs text-gray-400">{{ m.recipient }} · {{ dateTime(m.createdAt) }}<span v-if="m.sentBy"> · {{ m.sentBy }}</span></div>
                </div>
                <span class="text-xs shrink-0 px-1.5 py-0.5 rounded" :class="m.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">{{ m.status === 'sent' ? 'gesendet' : 'fehlgeschlagen' }}</span>
              </li>
              <li v-if="data.mails.length === 0" class="px-5 py-6 text-center text-gray-400 text-sm">Keine E-Mails.</li>
            </ul>
          </section>
        </div>

        <div class="space-y-6">
          <!-- Actions -->
          <section v-if="data.pending.status === 'pending'" class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Aktion</header>
            <div class="px-5 py-4 space-y-3">
              <p class="text-xs text-gray-500">Hat der Kunde per Antwort-Mail bestätigt? Dann hier bestätigen — die Bestellung wird angelegt und der Kunde &amp; die Administration benachrichtigt.</p>
              <button class="w-full px-3 py-2 bg-[#00af8c] text-white rounded text-sm font-medium hover:bg-[#009579] disabled:opacity-50" :disabled="busy" @click="confirm">
                {{ busy ? 'Bestätigt…' : 'Manuell bestätigen' }}
              </button>
              <button class="w-full px-3 py-2 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50 disabled:opacity-50" :disabled="busy" @click="cancel">
                Stornieren
              </button>
              <p v-if="actionMsg" class="text-sm rounded px-3 py-2" :class="actionError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'">{{ actionMsg }}</p>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Kunde</header>
            <div class="px-5 py-3 text-sm space-y-1">
              <div class="font-medium text-gray-800">{{ data.customer.name }}</div>
              <div v-if="data.customer.company" class="text-gray-600">{{ data.customer.company }}</div>
              <div><a :href="`mailto:${data.customer.email}`" class="text-[#00af8c] hover:underline">{{ data.customer.email }}</a></div>
              <div class="text-gray-600">Tel.: {{ data.customer.telephone || '–' }}</div>
              <div class="text-xs text-gray-400 pt-1">Kunden-Nr. {{ data.customer.id }}</div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Lieferadresse</header>
            <div class="px-5 py-3 text-sm text-gray-700 space-y-0.5">
              <div>{{ data.customer.name }}</div>
              <div>{{ data.customer.street }}</div>
              <div>{{ data.customer.postcode }} {{ data.customer.city }}</div>
              <div>{{ data.customer.country }}</div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Zahlung</header>
            <div class="px-5 py-3 text-sm text-gray-700">{{ data.payment }}</div>
            <div v-if="data.notes" class="px-5 pb-3 text-sm">
              <div class="font-semibold text-gray-800">Anmerkung</div>
              <div class="text-gray-600 whitespace-pre-wrap">{{ data.notes }}</div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { euro, dateTime, date } = useAdminFormat()
const route = useRoute()

interface FlowStep { id: number, name: string, state: 'done' | 'current' | 'upcoming', visitedAt: string | null }
interface PendingDetail {
  statusFlow: FlowStep[]
  pending: { id: number, status: string, ordersId: number | null, confirmedVia: string | null, createdAt: string, confirmedAt: string | null, total: number }
  customer: { id: number, name: string, company: string | null, email: string, telephone: string, street: string, postcode: string, city: string, country: string }
  items: { name: string, quantity: number, unitPrice: number, lineTotal: number }[]
  subtotal: number
  shipping: { label: string, price: number }
  taxRows: { description: string, total: number }[]
  payment: string
  notes: string
  total: number
  mails: { id: number, direction: string, recipient: string, mailType: string, subject: string, status: string, sentBy: string | null, createdAt: string }[]
}

const { data, error, refresh } = await useFetch<PendingDetail>(`/admin/api/pending/${route.params.id}`)
useHead({ title: () => `Bestätigung #${route.params.id} – Admin` })

const statusLabel = computed(() => {
  const s = data.value?.pending.status
  return s === 'materialized' ? 'Bestätigt' : s === 'cancelled' ? 'Storniert' : 'Bestätigung ausstehend'
})
const statusBadge = computed(() => {
  const s = data.value?.pending.status
  if (s === 'materialized') return 'bg-green-100 text-green-800'
  if (s === 'cancelled') return 'bg-gray-200 text-gray-600'
  return 'bg-amber-100 text-amber-800'
})
function viaLabel(via: string | null): string {
  return via === 'admin' ? 'manuell im Admin' : via === 'reply' ? 'per Antwort' : 'per Link'
}

function circleClass(state: FlowStep['state']): string {
  if (state === 'done') return 'bg-[#00af8c] text-white'
  if (state === 'current') return 'bg-[#00af8c] text-white ring-4 ring-[#00af8c]/25'
  return 'bg-white border-2 border-gray-300 text-gray-400'
}

const busy = ref(false)
const actionMsg = ref('')
const actionError = ref(false)

async function confirm() {
  busy.value = true
  actionMsg.value = ''
  try {
    const res = await $fetch<{ ok: boolean, orderId: number }>(`/admin/api/pending/${route.params.id}/confirm`, { method: 'POST' })
    actionError.value = false
    actionMsg.value = `Bestätigt – Bestellung #${res.orderId} angelegt.`
    await refresh()
  } catch (e) {
    actionError.value = true
    actionMsg.value = `Fehler: ${errMsg(e)}`
  } finally {
    busy.value = false
  }
}

async function cancel() {
  busy.value = true
  actionMsg.value = ''
  try {
    await $fetch(`/admin/api/pending/${route.params.id}/cancel`, { method: 'POST' })
    actionError.value = false
    actionMsg.value = 'Storniert.'
    await refresh()
  } catch (e) {
    actionError.value = true
    actionMsg.value = `Fehler: ${errMsg(e)}`
  } finally {
    busy.value = false
  }
}

function errMsg(e: unknown): string {
  const err = e as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
  return err?.data?.statusMessage || err?.statusMessage || err?.message || 'unbekannt'
}
</script>
