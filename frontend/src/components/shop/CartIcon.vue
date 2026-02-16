<template>
  <a
    href="/bestellung"
    class="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
    aria-label="Warenkorb"
  >
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      />
    </svg>
    <span
      v-if="count > 0"
      class="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
    >
      {{ count > 99 ? '99+' : count }}
    </span>
  </a>
</template>

<script setup lang="ts">
import { useStore } from '@nanostores/vue';
import { $cartCount } from '../../lib/cart';

const count = useStore($cartCount);
</script>
