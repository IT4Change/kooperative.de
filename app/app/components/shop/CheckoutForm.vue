<template>
  <div>
    <h3 class="text-lg font-semibold mb-4">Bestellformular</h3>
    <form class="space-y-3" @submit.prevent="$emit('submit')">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          v-model="formData.name"
          type="text"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4a7c59]"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Straße *</label>
        <input
          v-model="formData.street"
          type="text"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4a7c59]"
        />
      </div>
      <div class="flex gap-3">
        <div class="w-1/3">
          <label class="block text-sm font-medium text-gray-700 mb-1">PLZ *</label>
          <input
            v-model="formData.zip"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4a7c59]"
          />
        </div>
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">Ort *</label>
          <input
            v-model="formData.city"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4a7c59]"
          />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">E-Mail *</label>
        <input
          v-model="formData.email"
          type="email"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4a7c59]"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
        <input
          v-model="formData.phone"
          type="tel"
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4a7c59]"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Anmerkungen</label>
        <textarea
          v-model="formData.notes"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4a7c59] resize-none"
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
        <button
          type="submit"
          class="flex-1 py-2 text-sm bg-[#4a7c59] text-white rounded hover:bg-[#3d6a4a] transition-colors font-medium"
        >
          Weiter zur Übersicht
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { OrderFormData } from '~/data/products'

defineProps<{
  formData: OrderFormData
}>()

defineEmits<{
  submit: []
  back: []
}>()
</script>
