<template>
  <div>
    <h3 class="text-base font-semibold mb-3">Versandart</h3>
    <div class="space-y-2 mb-5">
      <label
        v-for="opt in SHIPPING_OPTIONS"
        :key="opt.id"
        class="flex items-start gap-3 px-3 py-2 border border-gray-200 rounded cursor-pointer hover:border-[#00af8c]"
        :class="{ 'border-[#00af8c] bg-[#00af8c]/5': shippingModel === opt.id }"
      >
        <input
          v-model="shippingModel"
          type="radio"
          :value="opt.id"
          name="shipping"
          class="mt-1 accent-[#00af8c]"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline justify-between gap-2">
            <strong class="text-sm">{{ opt.module }}</strong>
            <span class="text-sm text-gray-700 whitespace-nowrap">{{ opt.price }}</span>
          </div>
          <p class="text-xs text-gray-500 mt-0.5">{{ opt.description }}</p>
        </div>
      </label>
    </div>

    <h3 class="text-base font-semibold mb-3">Zahlungsart</h3>
    <div class="space-y-2 mb-5">
      <template v-for="opt in PAYMENT_OPTIONS" :key="opt.id">
        <label
          class="flex items-start gap-3 px-3 py-2 border border-gray-200 rounded cursor-pointer hover:border-[#00af8c]"
          :class="{ 'border-[#00af8c] bg-[#00af8c]/5': paymentModel === opt.id }"
        >
          <input
            v-model="paymentModel"
            type="radio"
            :value="opt.id"
            name="payment"
            class="mt-1 accent-[#00af8c]"
          />
          <div class="flex-1 min-w-0">
            <strong class="text-sm">{{ opt.label }}</strong>
            <p class="text-xs text-gray-500 mt-0.5">{{ opt.description }}</p>
          </div>
        </label>
        <div v-if="opt.id === 'lastschrift' && paymentModel === 'lastschrift'" class="mt-2 mb-1 ml-6 pl-2 border-l-2 border-[#00af8c]/30 space-y-2">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Kontoinhaber *</label>
            <input
              v-model="accountHolderModel"
              type="text"
              required
              maxlength="64"
              autocomplete="cc-name"
              class="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00af8c]"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">IBAN *</label>
            <input
              v-model="ibanModel"
              type="text"
              required
              maxlength="34"
              spellcheck="false"
              placeholder="DE12 3456 7890 1234 5678 90"
              class="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:border-[#00af8c]"
              :class="{ 'border-red-300': ibanInfo && !ibanInfo.valid && ibanLong }"
            />
            <p v-if="ibanInfo?.bankName" class="mt-1 text-xs text-[#00af8c] font-medium">
              ✓ {{ ibanInfo.bankName }}
              <span v-if="ibanInfo.blz" class="text-gray-400">· BLZ {{ ibanInfo.blz }}</span>
            </p>
            <p v-else-if="ibanInfo && ibanInfo.blz && !ibanInfo.bankName" class="mt-1 text-xs text-gray-500">
              BLZ {{ ibanInfo.blz }} (Bank nicht in der Bundesbank-Liste)
            </p>
            <p v-else-if="ibanInfo && !ibanInfo.valid && ibanLong" class="mt-1 text-xs text-red-600">
              IBAN ungültig — bitte prüfen
            </p>
            <p v-else class="mt-1 text-xs text-gray-500">DE/AT/CH/LI. Wir buchen den Betrag nach der Bestellung ab.</p>
          </div>
        </div>
      </template>
    </div>

    <div class="mb-5">
      <label class="block text-sm font-semibold text-gray-700 mb-1">Anmerkungen (optional)</label>
      <textarea
        v-model="notesModel"
        rows="3"
        maxlength="500"
        class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00af8c] resize-none"
        placeholder="z. B. Lieferzeit, Anlieferungswünsche…"
      />
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="button"
        class="flex-1 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        @click="$emit('back')"
      >
        Zurück
      </button>
      <KoopButton size="sm" :disabled="!canProceed" @click="$emit('next')">
        Weiter zur Übersicht
      </KoopButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SHIPPING_OPTIONS, PAYMENT_OPTIONS, type ShippingMethod, type PaymentMethod } from '~/data/checkoutOptions'

const props = defineProps<{
  shipping: ShippingMethod | null
  payment: PaymentMethod | null
  notes: string
  accountHolder: string
  iban: string
}>()

const emit = defineEmits<{
  back: []
  next: []
  'update:shipping': [ShippingMethod]
  'update:payment': [PaymentMethod]
  'update:notes': [string]
  'update:accountHolder': [string]
  'update:iban': [string]
}>()

const shippingModel = computed({
  get: () => props.shipping,
  set: (v) => v && emit('update:shipping', v),
})
const paymentModel = computed({
  get: () => props.payment,
  set: (v) => v && emit('update:payment', v),
})
const notesModel = computed({
  get: () => props.notes,
  set: (v) => emit('update:notes', v),
})
const accountHolderModel = computed({
  get: () => props.accountHolder,
  set: (v) => emit('update:accountHolder', v),
})
const ibanModel = computed({
  get: () => props.iban,
  set: (v) => emit('update:iban', v),
})

// Live IBAN info (debounced): hits server when user has typed enough characters
interface IbanInfoResponse { ok: boolean, country?: string, blz?: string, bankName?: string, valid?: boolean }
const ibanInfo = ref<IbanInfoResponse | null>(null)
const ibanCleaned = computed(() => ibanModel.value.replace(/\s+/g, '').toUpperCase())
const ibanLong = computed(() => ibanCleaned.value.length >= 15)
let ibanFetchSeq = 0
let ibanTimer: ReturnType<typeof setTimeout> | null = null
watch(ibanCleaned, (val) => {
  if (ibanTimer) clearTimeout(ibanTimer)
  if (val.length < 6) { ibanInfo.value = null; return }
  const mySeq = ++ibanFetchSeq
  ibanTimer = setTimeout(async () => {
    try {
      const res = await $fetch<IbanInfoResponse>('/api/iban/info', { query: { iban: val } })
      if (mySeq === ibanFetchSeq) ibanInfo.value = res
    } catch {
      if (mySeq === ibanFetchSeq) ibanInfo.value = null
    }
  }, 250)
})

const canProceed = computed(() => {
  if (!shippingModel.value || !paymentModel.value) return false
  if (paymentModel.value === 'lastschrift') {
    if (!accountHolderModel.value.trim()) return false
    if (!ibanLong.value) return false
    // If we have a server response, require validity. Otherwise let server validate on submit.
    if (ibanInfo.value && !ibanInfo.value.valid) return false
    return true
  }
  return true
})
</script>
