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
      <label
        v-for="opt in PAYMENT_OPTIONS"
        :key="opt.id"
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
      <KoopButton size="sm" :disabled="!shippingModel || !paymentModel" @click="$emit('next')">
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
}>()

const emit = defineEmits<{
  back: []
  next: []
  'update:shipping': [ShippingMethod]
  'update:payment': [PaymentMethod]
  'update:notes': [string]
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
</script>
