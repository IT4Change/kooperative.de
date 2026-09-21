<template>
  <div class="space-y-6">
    <NuxtLink to="/admin/orders" class="text-sm text-koop-blue hover:underline"
      >‹ Zurück zur Liste</NuxtLink
    >

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      {{
        error.statusCode === 404
          ? 'Bestellung nicht gefunden.'
          : error.statusMessage || error.message
      }}
    </div>

    <template v-if="data">
      <!-- Header -->
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-xl font-bold text-koop-ink">Bestellung #{{ data.order.id }}</h2>
        <span
          class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="statusClass(data.order.statusId)"
        >
          {{ data.order.statusName || `Status ${data.order.statusId}` }}
        </span>
        <span
          class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="
            data.origin === 'neu'
              ? 'bg-koop-blue/10 text-koop-blue'
              : 'bg-gray-100 text-koop-ink-muted'
          "
        >
          {{ data.origin === 'neu' ? 'Neuer Shop' : 'Alter Shop' }}
        </span>
        <span class="text-sm text-koop-ink-muted ml-auto">{{
          dateTime(data.order.datePurchased)
        }}</span>
        <a
          v-if="data.oldAdminUrl"
          :href="data.oldAdminUrl"
          target="_blank"
          rel="noopener"
          class="text-sm text-koop-ink-muted hover:text-koop-blue hover:underline whitespace-nowrap"
          >Alter Admin ↗</a
        >
      </div>

      <!-- Status stepper -->
      <AdminStatusFlow :steps="data.statusFlow">
        <p
          v-if="data.origin === 'alt'"
          class="mt-4 text-xs text-koop-ink-muted bg-gray-50 border border-gray-200 rounded px-3 py-2"
        >
          Diese Bestellung lief über den <strong>alten Shop</strong> – Schritt 1 entfällt, eine
          gesonderte Bestätigung durch den Kunden war dort nicht vorgesehen.
        </p>
        <template v-else-if="data.confirmation">
          <p class="mt-4 text-xs text-koop-ink-muted">
            <template v-if="data.confirmation.via === 'admin'">
              Manuell im Admin freigegeben<span v-if="data.confirmation.at">
                am {{ dateTime(data.confirmation.at) }}</span
              >.
            </template>
            <template v-else>
              Vom Kunden bestätigt ({{ viaLabel(data.confirmation.via) }})<span
                v-if="data.confirmation.at"
              >
                am {{ dateTime(data.confirmation.at) }}</span
              >.
            </template>
          </p>
          <p
            v-if="data.confirmation.note"
            class="mt-2 text-xs text-koop-ink-muted bg-amber-50 border border-amber-200 rounded px-3 py-2"
          >
            <span class="font-semibold">Begründung der Freischaltung:</span>
            <!-- ml-1 rather than a literal space: Vue's whitespace: 'condense'
                 drops whitespace between elements when it spans a newline. -->
            <span class="ml-1 whitespace-pre-wrap">{{ data.confirmation.note }}</span>
          </p>
        </template>
      </AdminStatusFlow>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Left: items + totals + history + mails -->
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
                <tr v-for="p in data.products" :key="p.id">
                  <td class="px-4 py-2.5">
                    <div class="text-koop-ink">{{ p.name }}</div>
                    <div class="text-xs text-koop-ink-muted">
                      Nr. {{ p.id }}<span v-if="p.model"> · {{ p.model }}</span> · MwSt
                      {{ p.tax }} %
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ p.quantity }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">{{ euro(p.finalPrice) }}</td>
                  <td class="px-4 py-2.5 text-right font-mono">
                    {{ euro(p.finalPrice * p.quantity) }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="border-t border-gray-200">
                <tr v-for="t in data.totals" :key="t.class + t.title">
                  <td
                    colspan="3"
                    class="px-4 py-1.5 text-right text-koop-ink-muted"
                    :class="{ 'font-bold text-koop-ink': t.class === 'ot_total' }"
                  >
                    {{ plain(t.title) }}
                  </td>
                  <td
                    class="px-4 py-1.5 text-right font-mono"
                    :class="{ 'font-bold': t.class === 'ot_total' }"
                  >
                    {{ plain(t.text) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <!-- Status history -->
          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Statusverlauf
            </header>
            <ul class="divide-y divide-gray-100">
              <li v-for="(h, i) in data.history" :key="i" class="px-5 py-3 flex items-start gap-3">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                  :class="statusClass(h.statusId)"
                >
                  {{ h.statusName || `Status ${h.statusId}` }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-xs text-koop-ink-muted">{{ dateTime(h.dateAdded) }}</div>
                  <div v-if="h.comments" class="text-sm text-koop-ink whitespace-pre-wrap mt-0.5">
                    {{ h.comments }}
                  </div>
                </div>
                <span
                  class="text-xs shrink-0"
                  :class="h.customerNotified ? 'text-green-600' : 'text-koop-ink-muted'"
                >
                  {{ h.customerNotified ? '✉ benachrichtigt' : '— keine Mail' }}
                </span>
              </li>
              <li
                v-if="data.history.length === 0"
                class="px-5 py-6 text-center text-koop-ink-muted text-sm"
              >
                Kein Verlauf vorhanden.
              </li>
            </ul>
          </section>

          <!-- Mail timeline -->
          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Gesendete E-Mails
            </header>
            <ul class="divide-y divide-gray-100">
              <li v-for="m in data.mails" :key="m.id" class="px-5 py-3 flex items-start gap-3">
                <span
                  class="shrink-0 mt-0.5 text-koop-ink-muted"
                  :title="m.direction === 'to_customer' ? 'an Kunde' : 'an Administration'"
                >
                  {{ m.direction === 'to_customer' ? '→ Kunde' : '→ Admin' }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-koop-ink">{{ m.subject }}</div>
                  <div class="text-xs text-koop-ink-muted">
                    {{ m.recipient }} · {{ mailTypeLabel(m.mailType) }} · {{ dateTime(m.createdAt)
                    }}<span v-if="m.sentBy"> · {{ m.sentBy }}</span>
                  </div>
                </div>
                <span
                  class="text-xs shrink-0 px-1.5 py-0.5 rounded"
                  :class="
                    m.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  "
                >
                  {{ m.status === 'sent' ? 'gesendet' : 'fehlgeschlagen' }}
                </span>
              </li>
              <li
                v-if="data.mails.length === 0"
                class="px-5 py-6 text-center text-koop-ink-muted text-sm"
              >
                Noch keine E-Mails zu dieser Bestellung.
              </li>
            </ul>
          </section>
        </div>

        <!-- Right: action + customer -->
        <div class="space-y-6">
          <!-- Operator action panel -->
          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Bearbeitung
            </header>
            <div class="px-5 py-4 space-y-3">
              <div>
                <label
                  :for="`${uid}-status`"
                  class="block text-xs font-medium text-koop-ink-muted mb-1"
                >
                  Status setzen
                </label>
                <select
                  :id="`${uid}-status`"
                  v-model="form.statusId"
                  class="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option v-for="s in data.availableStatuses" :key="s.id" :value="String(s.id)">
                    {{ s.name }}
                  </option>
                </select>
              </div>
              <div>
                <label
                  :for="`${uid}-comment`"
                  class="block text-xs font-medium text-koop-ink-muted mb-1"
                >
                  Nachricht an den Kunden (optional)
                </label>
                <textarea
                  :id="`${uid}-comment`"
                  v-model="form.comment"
                  rows="2"
                  class="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                  placeholder="Steht wörtlich in der Status-Mail, z. B. Paket ging heute raus, DPD-Nr. 0123456789"
                />
                <p class="mt-1 text-[11px] text-koop-ink-muted">
                  <span class="font-semibold text-amber-700">Geht an den Kunden.</span>
                  Wird in die Bestellhistorie geschrieben und — solange unten „Kunde per E-Mail
                  benachrichtigen" gesetzt ist — wörtlich in die Mail übernommen. „Benachrichtigung
                  erneut senden" verschickt den Text ebenfalls.
                </p>
              </div>
              <label class="flex items-center gap-2 text-sm text-koop-ink">
                <input
                  v-model="form.notify"
                  type="checkbox"
                  class="rounded border-gray-300 text-koop-blue focus:ring-koop-blue"
                />
                Kunde per E-Mail benachrichtigen
              </label>
              <button
                class="w-full px-3 py-2 bg-koop-blue text-white rounded text-sm font-medium hover:bg-koop-blue-hover disabled:opacity-50"
                :disabled="busy || form.statusId === ''"
                @click="submitStatus"
              >
                {{ busy ? 'Speichert…' : 'Status aktualisieren' }}
              </button>

              <div class="pt-2 border-t border-gray-100">
                <button
                  class="w-full px-3 py-2 border border-gray-300 text-koop-ink rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                  :disabled="busy"
                  @click="resend"
                >
                  Benachrichtigung (erneut) senden
                </button>
                <p class="text-[11px] text-koop-ink-muted mt-1">
                  Sendet dem Kunden die Mail zum aktuellen Status – ohne den Status zu ändern.
                </p>
              </div>

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
              <div class="font-medium text-koop-ink">{{ data.order.customer.name }}</div>
              <div v-if="data.order.customer.company" class="text-koop-ink-muted">
                {{ data.order.customer.company }}
              </div>
              <div>
                <a
                  :href="`mailto:${data.order.customer.email}`"
                  class="text-koop-blue hover:underline"
                  >{{ data.order.customer.email }}</a
                >
              </div>
              <div class="text-koop-ink-muted">
                Tel.: {{ data.order.customer.telephone || '–' }}
              </div>
              <div class="text-xs text-koop-ink-muted pt-1">
                Kunden-Nr. {{ data.order.customer.id }}
              </div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Lieferadresse
            </header>
            <div class="px-5 py-3 text-sm text-koop-ink space-y-0.5">
              <div>{{ data.order.delivery.name }}</div>
              <div v-if="data.order.delivery.company">{{ data.order.delivery.company }}</div>
              <div>{{ data.order.delivery.street }}</div>
              <div v-if="data.order.delivery.suburb">{{ data.order.delivery.suburb }}</div>
              <div>{{ data.order.delivery.postcode }} {{ data.order.delivery.city }}</div>
              <div>{{ data.order.delivery.country }}</div>
            </div>
          </section>

          <section class="bg-white rounded-lg shadow-sm border border-gray-200">
            <header class="px-5 py-3 border-b border-gray-100 font-semibold text-koop-ink">
              Zahlung
            </header>
            <div class="px-5 py-3 text-sm text-koop-ink">{{ data.order.paymentMethod || '–' }}</div>
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
  const { euro, dateTime, statusClass, errorMessage } = useAdminFormat()
  const route = useRoute()

  interface MailRow {
    id: number
    direction: string
    recipient: string
    mailType: string
    relatedStatusId: number | null
    subject: string
    status: string
    sentBy: string | null
    createdAt: string
  }
  interface OrderDetail {
    statusFlow: FlowStep[]
    origin: 'alt' | 'neu'
    confirmation: { via: string | null; at: string | null; note: string | null } | null
    oldAdminUrl: string | null
    availableStatuses: { id: number; name: string }[]
    mails: MailRow[]
    order: {
      id: number
      statusId: number
      statusName: string | null
      datePurchased: string
      lastModified: string
      paymentMethod: string
      currency: string
      customer: {
        id: number
        name: string
        company: string | null
        email: string
        telephone: string
        street: string
        suburb: string | null
        postcode: string
        city: string
        country: string
      }
      delivery: {
        name: string
        company: string | null
        street: string
        suburb: string | null
        postcode: string
        city: string
        country: string
      }
    }
    products: {
      id: number
      model: string
      name: string
      price: number
      finalPrice: number
      tax: number
      quantity: number
    }[]
    totals: { title: string; text: string; value: number | null; class: string }[]
    history: {
      statusId: number
      statusName: string | null
      dateAdded: string
      customerNotified: boolean
      comments: string
    }[]
  }

  const { data, error, refresh } = await useFetch<OrderDetail>(
    `/admin/api/orders/${route.params.id}`,
  )
  useHead({ title: () => `Bestellung #${route.params.id} – Admin` })

  /** orders_total title/text carry osCommerce markup (<b>, &nbsp;) — render as plain text. */
  function plain(s: string): string {
    return s
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim()
  }

  /**
   * Only the two ways the CUSTOMER can confirm. A manual release gets its own
   * sentence in the template, because it did not come from the customer at all.
   */
  function viaLabel(via: string | null): string {
    return via === 'reply' ? 'per Antwort' : 'per Link'
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
  watch(
    () => data.value?.order.statusId,
    (v) => {
      if (v != null) form.statusId = String(v)
    },
    { immediate: true },
  )

  const busy = ref(false)
  const actionMsg = ref('')
  const actionError = ref(false)

  async function submitStatus() {
    busy.value = true
    actionMsg.value = ''
    try {
      const res = await $fetch<{ notified: boolean; mail: { status: string } | null }>(
        `/admin/api/orders/${route.params.id}/status`,
        {
          method: 'POST',
          body: {
            statusId: Number(form.statusId),
            comment: form.comment,
            notifyCustomer: form.notify,
          },
        },
      )
      actionError.value = false
      actionMsg.value = res.notified
        ? `Status gesetzt · Kunde benachrichtigt (${res.mail?.status === 'sent' ? 'gesendet' : 'Mailfehler'})`
        : 'Status gesetzt.'
      form.comment = ''
      await refresh()
    } catch (e) {
      actionError.value = true
      actionMsg.value = `Fehler: ${errorMessage(e)}`
    } finally {
      busy.value = false
    }
  }

  async function resend() {
    busy.value = true
    actionMsg.value = ''
    try {
      const res = await $fetch<{ ok: boolean; mail: { status: string } }>(
        `/admin/api/orders/${route.params.id}/notify`,
        {
          method: 'POST',
          body: { comment: form.comment },
        },
      )
      actionError.value = !res.ok
      actionMsg.value = res.ok ? 'Benachrichtigung gesendet.' : 'Mailversand fehlgeschlagen.'
      await refresh()
    } catch (e) {
      actionError.value = true
      actionMsg.value = `Fehler: ${errorMessage(e)}`
    } finally {
      busy.value = false
    }
  }
</script>
