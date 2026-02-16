<template>
  <div class="text-center py-12 px-4">
    <!-- Checkmark Icon -->
    <div class="mx-auto w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-6">
      <svg class="w-10 h-10 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </div>

    <h2 class="text-2xl font-serif font-bold text-gray-900 mb-2">
      Vielen Dank für Ihre Bestellung!
    </h2>

    <p v-if="orderNumber" class="text-gray-600 mb-2">
      Ihre Bestellnummer: <span class="font-semibold text-gray-900">{{ orderNumber }}</span>
    </p>

    <p class="text-gray-500 mb-8">
      Bestätigung wird an <span class="font-medium text-gray-700">{{ customerEmail }}</span> gesendet.
    </p>

    <a
      href="/bestellung"
      class="inline-flex items-center gap-2 px-6 py-3 bg-primary-700 text-white font-medium rounded-lg hover:bg-primary-800 transition-colors no-underline"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
      </svg>
      Zurück zum Shop
    </a>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  orderNumber: string;
  customerEmail: string;
}>();
</script>
