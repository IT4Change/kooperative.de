<template>
  <div class="flex items-center gap-2">
    <!-- Quantity Selector -->
    <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
      <button
        type="button"
        class="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-sm"
        :disabled="quantity <= 1"
        @click="decrementQuantity"
      >
        -
      </button>
      <span class="w-8 h-9 flex items-center justify-center text-sm font-medium text-gray-900 bg-white">
        {{ quantity }}
      </span>
      <button
        type="button"
        class="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-sm"
        @click="incrementQuantity"
      >
        +
      </button>
    </div>

    <!-- Add to Cart Button -->
    <button
      type="button"
      :class="[
        'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        added
          ? 'bg-primary-100 text-primary-800 border border-primary-300'
          : 'bg-primary-700 text-white hover:bg-primary-800 active:scale-[0.97]',
      ]"
      :disabled="added"
      @click="handleAddToCart"
    >
      <svg
        v-if="!added"
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        />
      </svg>
      <svg
        v-else
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      {{ added ? 'Hinzugefügt!' : 'In den Warenkorb' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { addToCart } from '../../lib/cart';

const props = defineProps<{
  productId: number;
  documentId: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  image?: string;
}>();

const quantity = ref(1);
const added = ref(false);

function incrementQuantity() {
  quantity.value++;
}

function decrementQuantity() {
  if (quantity.value > 1) quantity.value--;
}

function handleAddToCart() {
  addToCart(
    {
      productId: props.productId,
      documentId: props.documentId,
      name: props.name,
      slug: props.slug,
      sku: props.sku,
      price: props.price,
      image: props.image || '',
    },
    quantity.value
  );

  added.value = true;
  setTimeout(() => {
    added.value = false;
    quantity.value = 1;
  }, 1500);
}
</script>
