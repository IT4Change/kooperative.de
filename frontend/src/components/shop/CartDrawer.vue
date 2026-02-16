<template>
  <div>
    <!-- Trigger Button -->
    <button
      type="button"
      class="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
      aria-label="Warenkorb öffnen"
      @click="open"
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
    </button>

    <!-- Backdrop -->
    <Transition name="backdrop">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40 bg-black/30"
        @click="close"
      />
    </Transition>

    <!-- Drawer Panel -->
    <Transition name="slide">
      <div
        v-if="isOpen"
        class="fixed top-0 right-0 z-50 h-full w-96 max-w-[90vw] bg-white shadow-2xl flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
          <h2 class="font-serif font-bold text-lg text-gray-900">Warenkorb</h2>
          <button
            type="button"
            class="inline-flex items-center justify-center w-10 h-10 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Warenkorb schließen"
            @click="close"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Cart Items -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="items.length > 0" class="divide-y divide-gray-100">
            <div
              v-for="item in items"
              :key="item.productId"
              class="flex gap-3 p-4"
            >
              <!-- Item Image -->
              <div class="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                <img
                  v-if="item.image"
                  :src="item.image"
                  :alt="item.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </div>
              </div>

              <!-- Item Details -->
              <div class="flex-1 min-w-0">
                <a
                  :href="`/bestellung/produkt/${item.slug}`"
                  class="text-sm font-medium text-gray-900 hover:text-primary-700 transition-colors no-underline line-clamp-2"
                >
                  {{ item.name }}
                </a>

                <p class="text-sm text-primary-700 font-semibold mt-0.5">
                  {{ priceFormatted(item.price) }}
                </p>

                <!-- Quantity Controls -->
                <div class="flex items-center justify-between mt-2">
                  <div class="flex items-center border border-gray-200 rounded-md overflow-hidden">
                    <button
                      type="button"
                      class="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-xs"
                      @click="handleUpdateQuantity(item.productId, item.quantity - 1)"
                    >
                      -
                    </button>
                    <span class="w-7 h-7 flex items-center justify-center text-xs font-medium text-gray-900 bg-white">
                      {{ item.quantity }}
                    </span>
                    <button
                      type="button"
                      class="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-xs"
                      @click="handleUpdateQuantity(item.productId, item.quantity + 1)"
                    >
                      +
                    </button>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-gray-700">
                      {{ priceFormatted(item.price * item.quantity) }}
                    </span>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Artikel entfernen"
                      @click="handleRemoveFromCart(item.productId)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="flex flex-col items-center justify-center py-16 px-6 text-center">
            <svg class="w-16 h-16 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <p class="text-gray-500 text-lg font-medium mb-1">Ihr Warenkorb ist leer</p>
            <p class="text-gray-400 text-sm">Stöbern Sie in unserem Angebot.</p>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="items.length > 0" class="border-t border-gray-200 px-5 py-4 shrink-0 space-y-3">
          <!-- Total -->
          <div class="flex items-center justify-between">
            <span class="text-base font-semibold text-gray-900">Gesamt</span>
            <span class="text-lg font-bold text-primary-700">{{ priceFormatted(total) }}</span>
          </div>

          <!-- Actions -->
          <div class="space-y-2">
            <a
              href="/bestellung"
              class="block w-full text-center px-4 py-2.5 bg-primary-700 text-white font-medium rounded-lg hover:bg-primary-800 transition-colors no-underline"
              @click="close"
            >
              Zur Bestellung
            </a>
            <button
              type="button"
              class="w-full text-center px-4 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
              @click="handleClearCart"
            >
              Warenkorb leeren
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useStore } from '@nanostores/vue';
import {
  $cartItems,
  $cartCount,
  $cartTotal,
  updateQuantity,
  removeFromCart,
  clearCart,
  formatPrice,
} from '../../lib/cart';

const items = useStore($cartItems);
const count = useStore($cartCount);
const total = useStore($cartTotal);

const isOpen = ref(false);

function priceFormatted(cents: number): string {
  return formatPrice(cents);
}

function open() {
  isOpen.value = true;
  updateBodyScroll();
}

function close() {
  isOpen.value = false;
  updateBodyScroll();
}

function updateBodyScroll() {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = isOpen.value ? 'hidden' : '';
  }
}

function handleUpdateQuantity(productId: number, quantity: number) {
  updateQuantity(productId, quantity);
}

function handleRemoveFromCart(productId: number) {
  removeFromCart(productId);
}

function handleClearCart() {
  clearCart();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* Backdrop transitions */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.25s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* Slide panel transitions */
.slide-enter-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-leave-active {
  transition: transform 0.25s ease-in;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
