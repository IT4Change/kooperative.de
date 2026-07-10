<template>
  <div class="max-w-[720px] mx-auto px-4 pt-32 pb-16 sm:px-6">
    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded-lg p-5 text-sm">
      Diese Bestellung konnte nicht gefunden werden. Bitte prüfen Sie den Link aus Ihrer E-Mail.
    </div>

    <template v-else-if="data">
      <!-- Confirmed state -->
      <div v-if="isConfirmed" class="text-center mb-8">
        <div class="w-14 h-14 rounded-full bg-[#00af8c]/10 text-[#00af8c] flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 class="text-2xl font-bold mb-2">Vielen Dank – Bestellung bestätigt</h1>
        <p class="text-gray-600">Ihre Bestellung<span v-if="orderId"> (Nr. {{ orderId }})</span> ist verbindlich bestätigt. Wir bearbeiten sie nun und melden uns bei Ihnen.</p>
      </div>

      <!-- Cancelled -->
      <div v-else-if="data.status === 'cancelled'" class="text-center mb-8">
        <h1 class="text-2xl font-bold mb-2">Bestellung storniert</h1>
        <p class="text-gray-600">Diese Bestellung wurde storniert und kann nicht mehr bestätigt werden.</p>
      </div>

      <!-- Pending → review + confirm -->
      <div v-else>
        <h1 class="text-2xl font-bold mb-1">Bestellung bestätigen</h1>
        <p class="text-gray-600 mb-6">Bitte prüfen Sie den Inhalt und bestätigen Sie Ihre Bestellung verbindlich.</p>
      </div>

      <!-- Order content (always shown) -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-left text-gray-500">
              <th class="px-4 py-2.5 font-medium">Artikel</th>
              <th class="px-4 py-2.5 font-medium text-right">Menge</th>
              <th class="px-4 py-2.5 font-medium text-right">Einzel</th>
              <th class="px-4 py-2.5 font-medium text-right">Summe</th>
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
          <tfoot class="border-t border-gray-200 text-sm">
            <tr><td colspan="3" class="px-4 py-1.5 text-right text-gray-600">Zwischensumme</td><td class="px-4 py-1.5 text-right font-mono">{{ euro(data.subtotal) }}</td></tr>
            <tr><td colspan="3" class="px-4 py-1.5 text-right text-gray-600">Versand ({{ data.shipping.label }})</td><td class="px-4 py-1.5 text-right font-mono">{{ data.shipping.price > 0 ? euro(data.shipping.price) : 'nach Aufwand' }}</td></tr>
            <tr v-for="(t, i) in data.taxRows" :key="i"><td colspan="3" class="px-4 py-1.5 text-right text-gray-500">{{ t.description }}</td><td class="px-4 py-1.5 text-right font-mono text-gray-500">{{ euro(t.total) }}</td></tr>
            <tr><td colspan="3" class="px-4 py-2 text-right font-bold">Gesamt</td><td class="px-4 py-2 text-right font-mono font-bold">{{ euro(data.total) }}</td></tr>
          </tfoot>
        </table>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="font-semibold text-gray-800 mb-1">Lieferung</div>
          <div class="text-gray-600">{{ data.customer.name }}</div>
          <div class="text-gray-600">{{ data.customer.street }}</div>
          <div class="text-gray-600">{{ data.customer.postcode }} {{ data.customer.city }}</div>
          <div class="text-gray-600">{{ data.customer.country }}</div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="font-semibold text-gray-800 mb-1">Zahlung</div>
          <div class="text-gray-600">{{ data.payment }}</div>
          <div v-if="data.notes" class="mt-2 font-semibold text-gray-800">Anmerkung</div>
          <div v-if="data.notes" class="text-gray-600 whitespace-pre-wrap">{{ data.notes }}</div>
        </div>
      </div>

      <!-- Confirm action -->
      <div v-if="showConfirm" class="mt-6 text-center">
        <p v-if="confirmError" class="text-red-600 text-sm mb-3">{{ confirmError }}</p>
        <button
          class="px-6 py-3 bg-[#00af8c] text-white rounded-lg font-semibold hover:bg-[#009579] disabled:opacity-50"
          :disabled="confirming"
          @click="confirm"
        >
          {{ confirming ? 'Wird bestätigt…' : 'Jetzt verbindlich bestätigen' }}
        </button>
        <p class="text-xs text-gray-400 mt-3">Alternativ können Sie einfach auf die Bestätigungs-E-Mail antworten.</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Bestellung bestätigen – Kooperative Dürnau' })

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

interface PendingView {
  status: string
  orderId: number | null
  customer: { name: string, email: string, street: string, postcode: string, city: string, country: string }
  items: { name: string, quantity: number, unitPrice: number, lineTotal: number }[]
  subtotal: number
  shipping: { label: string, price: number }
  taxRows: { description: string, total: number }[]
  payment: string
  notes: string
  total: number
}

const { data, error, refresh } = await useFetch<PendingView>(() => `/api/orders/pending/${token.value}`, {
  immediate: !!token.value,
})

const justConfirmed = ref(false)
const localOrderId = ref<number | null>(null)
const confirming = ref(false)
const confirmError = ref('')

const isConfirmed = computed(() => justConfirmed.value || data.value?.status === 'materialized' || data.value?.status === 'confirmed')
const orderId = computed(() => localOrderId.value ?? data.value?.orderId ?? null)
const showConfirm = computed(() => !isConfirmed.value && data.value?.status === 'pending')

function euro(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`
}

async function confirm() {
  confirming.value = true
  confirmError.value = ''
  try {
    const res = await $fetch<{ ok: boolean, orderId: number }>('/api/orders/confirm', {
      method: 'POST',
      body: { token: token.value },
    })
    localOrderId.value = res.orderId
    justConfirmed.value = true
    await refresh()
  } catch (e) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    confirmError.value = err?.data?.statusMessage || err?.statusMessage || 'Bestätigung fehlgeschlagen.'
  } finally {
    confirming.value = false
  }
}
</script>
