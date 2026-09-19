<template>
  <div class="space-y-6">
    <NuxtLink to="/admin/orders?status=pending" class="text-sm text-koop-blue hover:underline"
      >‹ Zurück zur Liste</NuxtLink
    >

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      {{
        error.statusCode === 404 ? 'Vorgang nicht gefunden.' : error.statusMessage || error.message
      }}
    </div>

    <template v-if="data">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-xl font-bold text-koop-ink">
          Bestellung<span v-if="data.pending.ordersId"> #{{ data.pending.ordersId }}</span>
        </h2>
        <!-- Only until the confirmation materialised one — afterwards the number
             above is the truth, and claiming there is none contradicts the
             green panel further down. -->
        <span v-if="!data.pending.ordersId" class="text-sm text-koop-ink-muted"
          >noch keine Bestell-Nr.</span
        >
        <span
          class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="statusBadge"
          >{{ statusLabel }}</span
        >
        <span
          class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-koop-blue/10 text-koop-blue"
          >Neuer Shop</span
        >
        <span class="text-sm text-koop-ink-muted ml-auto">{{
          dateTime(data.pending.createdAt)
        }}</span>
      </div>

      <!-- Status graphic -->
      <AdminStatusFlow v-if="data.pending.status !== 'cancelled'" :steps="data.statusFlow">
        <p
          v-if="data.pending.status !== 'materialized'"
          class="mt-4 text-xs text-koop-ink-muted bg-amber-50 border border-amber-200 rounded px-3 py-2"
        >
          Diese Bestellung wartet auf die Bestätigung des Kunden (Link oder Antwort-Mail). Erst
          danach wird sie als Bestellung mit Nummer angelegt.
        </p>
        <p
          v-else-if="data.pending.confirmNote"
          class="mt-4 text-xs text-koop-ink-muted bg-amber-50 border border-amber-200 rounded px-3 py-2"
        >
          <span class="font-semibold">Begründung der Freischaltung:</span>
          <!-- ml-1 rather than a literal space: Vue's whitespace: 'condense'
               drops whitespace between elements when it spans a newline. -->
          <span class="ml-1 whitespace-pre-wrap">{{ data.pending.confirmNote }}</span>
        </p>
      </AdminStatusFlow>

      <div
        v-if="data.pending.status === 'materialized' && data.pending.ordersId"
        class="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800"
      >
        Bestätigt ({{ viaLabel(data.pending.confirmedVia) }}) und als Bestellung angelegt.
        <NuxtLink :to="`/admin/orders/${data.pending.ordersId}`" class="font-medium underline"
          >Zur Bestellung #{{ data.pending.ordersId }} →</NuxtLink
        >
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-6">
          <section class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Positionen
            </header>
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 text-left text-koop-ink-muted">
                  <th class="px-4 py-2 font-medium">Artikel</th>
                  <th class="px-4 py-2 font-medium text-right">Menge</th>
                  <th class="px-4 py-2 font-medium text-right">Einzel</th>
                  <th class="px-4 py-2 font-medium text-right">Summe</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(it, i) in data.items" :key="i">
                  <td class="px-4 py-2.5 text-koop-ink">{{ it.name }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ it.quantity }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ euro(it.unitPrice) }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ euro(it.lineTotal) }}</td>
                </tr>
              </tbody>
              <tfoot class="border-t border-gray-200">
                <tr>
                  <td colspan="3" class="px-4 py-1.5 text-right text-koop-ink-muted">
                    Zwischensumme
                  </td>
                  <td class="px-4 py-1.5 text-right font-mono">{{ euro(data.subtotal) }}</td>
                </tr>
                <tr>
                  <td colspan="3" class="px-4 py-1.5 text-right text-koop-ink-muted">
                    Versand ({{ data.shipping.label }})
                  </td>
                  <td class="px-4 py-1.5 text-right font-mono">
                    {{ data.shipping.price > 0 ? euro(data.shipping.price) : 'nach Aufwand' }}
                  </td>
                </tr>
                <tr v-for="(t, i) in data.taxRows" :key="i">
                  <td colspan="3" class="px-4 py-1.5 text-right text-koop-ink-muted">
                    {{ t.description }}
                  </td>
                  <td class="px-4 py-1.5 text-right font-mono text-koop-ink-muted">
                    {{ euro(t.total) }}
                  </td>
                </tr>
                <tr>
                  <td colspan="3" class="px-4 py-2 text-right font-bold">Gesamt</td>
                  <td class="px-4 py-2 text-right font-mono font-bold">{{ euro(data.total) }}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Gesendete E-Mails
            </header>
            <ul class="divide-y divide-gray-100">
              <li v-for="m in data.mails" :key="m.id" class="px-5 py-3 flex items-start gap-3">
                <span class="shrink-0 mt-0.5 text-koop-ink-muted">{{
                  m.direction === 'to_customer' ? '→ Kunde' : '→ Admin'
                }}</span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-koop-ink">{{ m.subject }}</div>
                  <div class="text-xs text-koop-ink-muted">
                    {{ m.recipient }} · {{ dateTime(m.createdAt)
                    }}<span v-if="m.sentBy"> · {{ m.sentBy }}</span>
                  </div>
                </div>
                <span
                  class="text-xs shrink-0 px-1.5 py-0.5 rounded"
                  :class="
                    m.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  "
                  >{{ m.status === 'sent' ? 'gesendet' : 'fehlgeschlagen' }}</span
                >
              </li>
              <li
                v-if="data.mails.length === 0"
                class="px-5 py-6 text-center text-koop-ink-muted text-sm"
              >
                Keine E-Mails.
              </li>
            </ul>
          </section>
        </div>

        <div class="space-y-6">
          <!-- Actions -->
          <section
            v-if="data.pending.status === 'pending'"
            class="bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Aktion
            </header>
            <div class="px-5 py-4 space-y-3">
              <p class="text-xs text-koop-ink-muted">
                Hat der Kunde per Antwort-Mail bestätigt? Dann hier bestätigen — die Bestellung wird
                angelegt und der Kunde &amp; die Administration benachrichtigt.
              </p>
              <div>
                <label :for="`${uid}-reason`" class="block text-xs font-medium text-koop-ink mb-1">
                  Begründung <span class="text-red-600">*</span>
                  <span class="font-normal text-koop-ink-muted">— bleibt intern</span>
                </label>
                <textarea
                  :id="`${uid}-reason`"
                  v-model="reason"
                  rows="4"
                  :disabled="busy"
                  placeholder="Der Kunde sieht diesen Text nie. Warum wird ohne Kundenbestätigung freigegeben? z. B. telefonisch bestätigt am 14.09., Rückruf von Frau Müller"
                  class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-koop-blue focus:border-koop-blue disabled:bg-gray-50"
                />
                <p class="mt-1 text-[11px] text-koop-ink-muted">
                  <span class="font-semibold text-koop-ink">Geht nicht an den Kunden.</span>
                  Festgehalten am Vorgang, in der Bestellhistorie (auch im alten Admin) und in der
                  Benachrichtigung an die Administration. Pflichtfeld, weil eine Freigabe ohne
                  Bestätigung des Kunden belegt sein muss.
                </p>
              </div>
              <button
                class="w-full px-3 py-2 bg-koop-blue text-white rounded text-sm font-medium hover:bg-koop-blue-hover disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="busy || !reason.trim()"
                :title="reason.trim() ? undefined : 'Bitte zuerst eine Begründung eingeben'"
                @click="confirm"
              >
                {{ busy ? 'Bestätigt…' : 'Manuell bestätigen' }}
              </button>
              <button
                class="w-full px-3 py-2 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50 disabled:opacity-50"
                :disabled="busy"
                @click="cancel"
              >
                Stornieren
              </button>
              <p
                v-if="actionMsg"
                class="text-sm rounded px-3 py-2"
                :class="actionError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'"
              >
                {{ actionMsg }}
              </p>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Kunde
            </header>
            <div class="px-5 py-3 text-sm space-y-1">
              <div class="font-medium text-koop-ink">{{ data.customer.name }}</div>
              <div v-if="data.customer.company" class="text-koop-ink-muted">
                {{ data.customer.company }}
              </div>
              <div>
                <a :href="`mailto:${data.customer.email}`" class="text-koop-blue hover:underline">{{
                  data.customer.email
                }}</a>
              </div>
              <div class="text-koop-ink-muted">Tel.: {{ data.customer.telephone || '–' }}</div>
              <div class="text-xs text-koop-ink-muted pt-1">Kunden-Nr. {{ data.customer.id }}</div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Lieferadresse
            </header>
            <div class="px-5 py-3 text-sm text-koop-ink space-y-0.5">
              <div>{{ data.customer.name }}</div>
              <div>{{ data.customer.street }}</div>
              <div>{{ data.customer.postcode }} {{ data.customer.city }}</div>
              <div>{{ data.customer.country }}</div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Zahlung
            </header>
            <div class="px-5 py-3 text-sm text-koop-ink">{{ data.payment }}</div>
            <div v-if="data.notes" class="px-5 pb-3 text-sm">
              <div class="font-semibold text-koop-ink">Anmerkung</div>
              <div class="text-koop-ink-muted whitespace-pre-wrap">{{ data.notes }}</div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { FlowStep } from '~/components/admin/StatusFlow.vue'

  definePageMeta({ layout: 'admin' })

  const uid = useId()
  const { euro, dateTime, errorMessage } = useAdminFormat()
  const route = useRoute()

  interface PendingDetail {
    statusFlow: FlowStep[]
    pending: {
      id: number
      status: string
      ordersId: number | null
      confirmedVia: string | null
      confirmNote: string | null
      createdAt: string
      confirmedAt: string | null
      total: number
    }
    customer: {
      id: number
      name: string
      company: string | null
      email: string
      telephone: string
      street: string
      postcode: string
      city: string
      country: string
    }
    items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[]
    subtotal: number
    shipping: { label: string; price: number }
    taxRows: { description: string; total: number }[]
    payment: string
    notes: string
    total: number
    mails: {
      id: number
      direction: string
      recipient: string
      mailType: string
      subject: string
      status: string
      sentBy: string | null
      createdAt: string
    }[]
  }

  const { data, error, refresh } = await useFetch<PendingDetail>(
    `/admin/api/pending/${route.params.id}`,
  )
  useHead({ title: () => `Bestätigung #${route.params.id} – Admin` })

  const statusLabel = computed(() => {
    const s = data.value?.pending.status
    return s === 'materialized'
      ? 'Bestätigt'
      : s === 'cancelled'
        ? 'Storniert'
        : 'Bestätigung ausstehend'
  })
  const statusBadge = computed(() => {
    const s = data.value?.pending.status
    if (s === 'materialized') return 'bg-green-100 text-green-800'
    if (s === 'cancelled') return 'bg-gray-200 text-koop-ink-muted'
    return 'bg-amber-100 text-amber-800'
  })
  function viaLabel(via: string | null): string {
    return via === 'admin' ? 'manuell im Admin' : via === 'reply' ? 'per Antwort' : 'per Link'
  }

  const busy = ref(false)
  const actionMsg = ref('')
  const actionError = ref(false)
  /**
   * Reason for releasing without the customer's confirmation. Mandatory — the
   * button stays disabled while it is empty, and the endpoint refuses the call
   * regardless, so the requirement does not depend on the form.
   */
  const reason = ref('')

  async function confirm() {
    busy.value = true
    actionMsg.value = ''
    try {
      const res = await $fetch<{ ok: boolean; orderId: number }>(
        `/admin/api/pending/${route.params.id}/confirm`,
        { method: 'POST', body: { reason: reason.value.trim() } },
      )
      actionError.value = false
      actionMsg.value = `Bestätigt – Bestellung #${res.orderId} angelegt.`
      // On to the order. This view deliberately has no editing panel — it shows
      // the confirmation process, not the order — so staying here left the
      // operator on a page that offers nothing more to do, and no reload could
      // change that. The order carries the release note and its reason in its
      // own header, so nothing is lost on the way.
      await navigateTo(`/admin/orders/${res.orderId}`)
    } catch (e) {
      actionError.value = true
      actionMsg.value = `Fehler: ${errorMessage(e)}`
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
      actionMsg.value = `Fehler: ${errorMessage(e)}`
    } finally {
      busy.value = false
    }
  }
</script>
