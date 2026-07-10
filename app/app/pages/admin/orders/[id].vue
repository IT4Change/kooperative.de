<template>
  <div class="space-y-6">
    <NuxtLink to="/admin/orders" class="text-sm text-[#00af8c] hover:underline">‹ Zurück zur Liste</NuxtLink>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      {{ error.statusCode === 404 ? 'Bestellung nicht gefunden.' : (error.statusMessage || error.message) }}
    </div>

    <template v-if="data">
      <!-- Header -->
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-xl font-bold text-gray-800">Bestellung #{{ data.order.id }}</h2>
        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium" :class="statusClass(data.order.statusId)">
          {{ data.order.statusName || `Status ${data.order.statusId}` }}
        </span>
        <span
          class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="data.origin === 'neu' ? 'bg-[#00af8c]/10 text-[#00838a]' : 'bg-gray-100 text-gray-500'"
        >
          {{ data.origin === 'neu' ? 'Neuer Shop' : 'Alter Shop' }}
        </span>
        <span class="text-sm text-gray-500 ml-auto">{{ dateTime(data.order.datePurchased) }}</span>
        <a v-if="data.oldAdminUrl" :href="data.oldAdminUrl" target="_blank" rel="noopener" class="text-sm text-gray-500 hover:text-[#00af8c] hover:underline whitespace-nowrap">Alter Admin ↗</a>
      </div>

      <!-- Status stepper -->
      <section class="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-5">
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
        <p v-if="data.origin === 'alt'" class="mt-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2">
          Diese Bestellung lief über den <strong>alten Shop</strong> – es fand keine gesonderte Bestätigung durch den Kunden statt.
        </p>
        <p v-else-if="data.confirmation" class="mt-4 text-xs text-gray-500">
          Vom Kunden bestätigt ({{ viaLabel(data.confirmation.via) }})<span v-if="data.confirmation.at"> am {{ dateTime(data.confirmation.at) }}</span>.
        </p>
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Left: items + totals + history + mails -->
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
                <tr v-for="p in data.products" :key="p.id">
                  <td class="px-4 py-2.5">
                    <div class="text-gray-800">{{ p.name }}</div>
                    <div class="text-xs text-gray-400">Nr. {{ p.id }}<span v-if="p.model"> · {{ p.model }}</span> · MwSt {{ p.tax }} %</div>
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ p.quantity }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ euro(p.finalPrice) }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ euro(p.finalPrice * p.quantity) }}</td>
                </tr>
              </tbody>
              <tfoot class="border-t border-gray-200">
                <tr v-for="t in data.totals" :key="t.class + t.title">
                  <td colspan="3" class="px-4 py-1.5 text-right text-gray-600" :class="{ 'font-bold text-gray-900': t.class === 'ot_total' }">{{ plain(t.title) }}</td>
                  <td class="px-4 py-1.5 text-right font-mono" :class="{ 'font-bold': t.class === 'ot_total' }">{{ plain(t.text) }}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <!-- Status history -->
          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Statusverlauf</header>
            <ul class="divide-y divide-gray-100">
              <li v-for="(h, i) in data.history" :key="i" class="px-5 py-3 flex items-start gap-3">
                <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0" :class="statusClass(h.statusId)">
                  {{ h.statusName || `Status ${h.statusId}` }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-xs text-gray-500">{{ dateTime(h.dateAdded) }}</div>
                  <div v-if="h.comments" class="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{{ h.comments }}</div>
                </div>
                <span class="text-xs shrink-0" :class="h.customerNotified ? 'text-green-600' : 'text-gray-400'">
                  {{ h.customerNotified ? '✉ benachrichtigt' : '— keine Mail' }}
                </span>
              </li>
              <li v-if="data.history.length === 0" class="px-5 py-6 text-center text-gray-400 text-sm">Kein Verlauf vorhanden.</li>
            </ul>
          </section>

          <!-- Mail timeline -->
          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Gesendete E-Mails</header>
            <ul class="divide-y divide-gray-100">
              <li v-for="m in data.mails" :key="m.id" class="px-5 py-3 flex items-start gap-3">
                <span class="shrink-0 mt-0.5 text-gray-400" :title="m.direction === 'to_customer' ? 'an Kunde' : 'an Administration'">
                  {{ m.direction === 'to_customer' ? '→ Kunde' : '→ Admin' }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-gray-800">{{ m.subject }}</div>
                  <div class="text-xs text-gray-400">{{ m.recipient }} · {{ mailTypeLabel(m.mailType) }} · {{ dateTime(m.createdAt) }}<span v-if="m.sentBy"> · {{ m.sentBy }}</span></div>
                </div>
                <span class="text-xs shrink-0 px-1.5 py-0.5 rounded" :class="m.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                  {{ m.status === 'sent' ? 'gesendet' : 'fehlgeschlagen' }}
                </span>
              </li>
              <li v-if="data.mails.length === 0" class="px-5 py-6 text-center text-gray-400 text-sm">Noch keine E-Mails zu dieser Bestellung.</li>
            </ul>
          </section>
        </div>

        <!-- Right: action + customer -->
        <div class="space-y-6">
          <!-- Operator action panel -->
          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Bearbeitung</header>
            <div class="px-5 py-4 space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Status setzen</label>
                <select v-model="form.statusId" class="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white">
                  <option v-for="s in data.availableStatuses" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Kommentar (optional)</label>
                <textarea v-model="form.comment" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none" placeholder="Interne Notiz / Text für Kundenmail" />
              </div>
              <label class="flex items-center gap-2 text-sm text-gray-700">
                <input v-model="form.notify" type="checkbox" class="rounded border-gray-300 text-[#00af8c] focus:ring-[#00af8c]">
                Kunde per E-Mail benachrichtigen
              </label>
              <button
                class="w-full px-3 py-2 bg-[#00af8c] text-white rounded text-sm font-medium hover:bg-[#009579] disabled:opacity-50"
                :disabled="busy || form.statusId === ''"
                @click="submitStatus"
              >
                {{ busy ? 'Speichert…' : 'Status aktualisieren' }}
              </button>

              <div class="pt-2 border-t border-gray-100">
                <button
                  class="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                  :disabled="busy"
                  @click="resend"
                >
                  Benachrichtigung (erneut) senden
                </button>
                <p class="text-[11px] text-gray-400 mt-1">Sendet dem Kunden die Mail zum aktuellen Status – ohne den Status zu ändern.</p>
              </div>

              <p v-if="actionMsg" class="text-sm rounded px-3 py-2" :class="actionError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'">
                {{ actionMsg }}
              </p>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Kunde</header>
            <div class="px-5 py-3 text-sm space-y-1">
              <div class="font-medium text-gray-800">{{ data.order.customer.name }}</div>
              <div v-if="data.order.customer.company" class="text-gray-600">{{ data.order.customer.company }}</div>
              <div><a :href="`mailto:${data.order.customer.email}`" class="text-[#00af8c] hover:underline">{{ data.order.customer.email }}</a></div>
              <div class="text-gray-600">Tel.: {{ data.order.customer.telephone || '–' }}</div>
              <div class="text-xs text-gray-400 pt-1">Kunden-Nr. {{ data.order.customer.id }}</div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Lieferadresse</header>
            <div class="px-5 py-3 text-sm text-gray-700 space-y-0.5">
              <div>{{ data.order.delivery.name }}</div>
              <div v-if="data.order.delivery.company">{{ data.order.delivery.company }}</div>
              <div>{{ data.order.delivery.street }}</div>
              <div v-if="data.order.delivery.suburb">{{ data.order.delivery.suburb }}</div>
              <div>{{ data.order.delivery.postcode }} {{ data.order.delivery.city }}</div>
              <div>{{ data.order.delivery.country }}</div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800">Zahlung</header>
            <div class="px-5 py-3 text-sm text-gray-700">{{ data.order.paymentMethod || '–' }}</div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { euro, dateTime, date, statusClass } = useAdminFormat()
const route = useRoute()

interface FlowStep { id: number, name: string, state: 'done' | 'current' | 'upcoming', visitedAt: string | null }
interface MailRow { id: number, direction: string, recipient: string, mailType: string, relatedStatusId: number | null, subject: string, status: string, sentBy: string | null, createdAt: string }
interface OrderDetail {
  statusFlow: FlowStep[]
  origin: 'alt' | 'neu'
  confirmation: { via: string | null, at: string | null } | null
  oldAdminUrl: string | null
  availableStatuses: { id: number, name: string }[]
  mails: MailRow[]
  order: {
    id: number, statusId: number, statusName: string | null, datePurchased: string,
    lastModified: string, paymentMethod: string, currency: string,
    customer: { id: number, name: string, company: string | null, email: string, telephone: string, street: string, suburb: string | null, postcode: string, city: string, country: string },
    delivery: { name: string, company: string | null, street: string, suburb: string | null, postcode: string, city: string, country: string },
  }
  products: { id: number, model: string, name: string, price: number, finalPrice: number, tax: number, quantity: number }[]
  totals: { title: string, text: string, value: number | null, class: string }[]
  history: { statusId: number, statusName: string | null, dateAdded: string, customerNotified: boolean, comments: string }[]
}

const { data, error, refresh } = await useFetch<OrderDetail>(`/admin/api/orders/${route.params.id}`)
useHead({ title: () => `Bestellung #${route.params.id} – Admin` })

/** orders_total title/text carry osCommerce markup (<b>, &nbsp;) — render as plain text. */
function plain(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}

function viaLabel(via: string | null): string {
  return via === 'admin' ? 'manuell im Admin' : via === 'reply' ? 'per Antwort' : 'per Link'
}

function circleClass(state: FlowStep['state']): string {
  if (state === 'done') return 'bg-[#00af8c] text-white'
  if (state === 'current') return 'bg-[#00af8c] text-white ring-4 ring-[#00af8c]/25'
  return 'bg-white border-2 border-gray-300 text-gray-400'
}

const MAIL_TYPE_LABELS: Record<string, string> = {
  status_notification: 'Statusmeldung',
  status_notification_resend: 'Statusmeldung (erneut)',
  order_confirmation_request: 'Bestätigungsanfrage',
  operator_notification: 'Betreiber-Info',
}
function mailTypeLabel(t: string): string {
  return MAIL_TYPE_LABELS[t] ?? t
}

// --- operator actions ---
const form = reactive({ statusId: '', comment: '', notify: true })
watch(() => data.value?.order.statusId, (v) => { if (v != null) form.statusId = String(v) }, { immediate: true })

const busy = ref(false)
const actionMsg = ref('')
const actionError = ref(false)

async function submitStatus() {
  busy.value = true
  actionMsg.value = ''
  try {
    const res = await $fetch<{ notified: boolean, mail: { status: string } | null }>(`/admin/api/orders/${route.params.id}/status`, {
      method: 'POST',
      body: { statusId: Number(form.statusId), comment: form.comment, notifyCustomer: form.notify },
    })
    actionError.value = false
    actionMsg.value = res.notified
      ? `Status gesetzt · Kunde benachrichtigt (${res.mail?.status === 'sent' ? 'gesendet' : 'Mailfehler'})`
      : 'Status gesetzt.'
    form.comment = ''
    await refresh()
  } catch (e) {
    actionError.value = true
    actionMsg.value = `Fehler: ${errMsg(e)}`
  } finally {
    busy.value = false
  }
}

async function resend() {
  busy.value = true
  actionMsg.value = ''
  try {
    const res = await $fetch<{ ok: boolean, mail: { status: string } }>(`/admin/api/orders/${route.params.id}/notify`, {
      method: 'POST',
      body: { comment: form.comment },
    })
    actionError.value = !res.ok
    actionMsg.value = res.ok ? 'Benachrichtigung gesendet.' : 'Mailversand fehlgeschlagen.'
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
