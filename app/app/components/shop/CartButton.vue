<template>
  <button
    v-if="totalItems > 0"
    class="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#4a7c59] text-white rounded-full shadow-lg hover:bg-[#3d6a4a] transition-colors flex items-center justify-center"
    aria-label="Warenkorb öffnen"
    @click="openCart"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
      {{ totalItems }}
    </span>
  </button>
</template>

<script setup lang="ts">
const { totalItems, openCart } = useCart()
</script>
