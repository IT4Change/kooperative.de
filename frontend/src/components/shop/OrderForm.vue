<template>
  <div>
    <!-- Order Confirmation -->
    <div v-if="orderComplete">
      <OrderConfirmation
        :order-number="orderNumber"
        :customer-email="form.customerEmail"
      />
    </div>

    <!-- Order Form -->
    <div v-else>
      <!-- Order Summary -->
      <div v-if="items.length > 0" class="mb-8">
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-4">Bestellübersicht</h2>
        <div class="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          <div class="divide-y divide-gray-200">
            <div
              v-for="item in items"
              :key="item.productId"
              class="flex items-center justify-between px-4 py-3 md:px-5"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ item.name }}</p>
                <p class="text-xs text-gray-500">
                  {{ item.quantity }} x {{ priceFormatted(item.price) }}
                </p>
              </div>
              <p class="text-sm font-semibold text-gray-700 ml-4">
                {{ priceFormatted(item.price * item.quantity) }}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-between px-4 py-3 md:px-5 bg-primary-50 border-t border-primary-200">
            <span class="font-semibold text-gray-900">Gesamt</span>
            <span class="text-lg font-bold text-primary-700">{{ priceFormatted(total) }}</span>
          </div>
        </div>
      </div>

      <!-- Empty Cart Warning -->
      <div v-else class="text-center py-12 mb-8">
        <svg class="mx-auto w-16 h-16 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
        <p class="text-gray-500 text-lg mb-2">Ihr Warenkorb ist leer.</p>
        <a
          href="/bestellung"
          class="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium no-underline"
        >
          Zum Shop
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      </div>

      <!-- Form -->
      <form v-if="items.length > 0" @submit.prevent="handleSubmit" class="space-y-6">
        <h2 class="text-xl font-serif font-bold text-gray-900">Ihre Daten</h2>

        <!-- Error Display -->
        <div
          v-if="error"
          class="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2"
        >
          <svg class="w-5 h-5 shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          {{ error }}
        </div>

        <!-- Name -->
        <div>
          <label for="customerName" class="block text-sm font-medium text-gray-700 mb-1">
            Name <span class="text-red-500">*</span>
          </label>
          <input
            id="customerName"
            v-model="form.customerName"
            type="text"
            required
            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            placeholder="Ihr vollständiger Name"
          />
          <p v-if="fieldErrors.customerName" class="mt-1 text-xs text-red-600">{{ fieldErrors.customerName }}</p>
        </div>

        <!-- Email -->
        <div>
          <label for="customerEmail" class="block text-sm font-medium text-gray-700 mb-1">
            E-Mail-Adresse <span class="text-red-500">*</span>
          </label>
          <input
            id="customerEmail"
            v-model="form.customerEmail"
            type="email"
            required
            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            placeholder="ihre@email.de"
          />
          <p v-if="fieldErrors.customerEmail" class="mt-1 text-xs text-red-600">{{ fieldErrors.customerEmail }}</p>
        </div>

        <!-- Phone -->
        <div>
          <label for="customerPhone" class="block text-sm font-medium text-gray-700 mb-1">
            Telefon <span class="text-gray-400 text-xs font-normal">(optional)</span>
          </label>
          <input
            id="customerPhone"
            v-model="form.customerPhone"
            type="tel"
            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            placeholder="Ihre Telefonnummer"
          />
        </div>

        <!-- Address -->
        <div>
          <label for="customerAddress" class="block text-sm font-medium text-gray-700 mb-1">
            Adresse <span class="text-red-500">*</span>
          </label>
          <textarea
            id="customerAddress"
            v-model="form.customerAddress"
            required
            rows="3"
            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-y"
            placeholder="Straße, Hausnummer&#10;PLZ Ort"
          />
          <p v-if="fieldErrors.customerAddress" class="mt-1 text-xs text-red-600">{{ fieldErrors.customerAddress }}</p>
        </div>

        <!-- Message -->
        <div>
          <label for="message" class="block text-sm font-medium text-gray-700 mb-1">
            Nachricht <span class="text-gray-400 text-xs font-normal">(optional)</span>
          </label>
          <textarea
            id="message"
            v-model="form.message"
            rows="3"
            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-y"
            placeholder="Besondere Wünsche oder Anmerkungen"
          />
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading"
          :class="[
            'w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-base font-medium transition-all duration-200',
            loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-700 text-white hover:bg-primary-800 active:scale-[0.98]',
          ]"
        >
          <svg
            v-if="loading"
            class="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {{ loading ? 'Wird gesendet...' : 'Bestellung absenden' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useStore } from '@nanostores/vue';
import {
  $cartItems,
  $cartTotal,
  clearCart,
  formatPrice,
} from '../../lib/cart';
import { submitOrder } from '../../lib/strapi';
import OrderConfirmation from './OrderConfirmation.vue';

const items = useStore($cartItems);
const total = useStore($cartTotal);

const loading = ref(false);
const error = ref('');
const orderComplete = ref(false);
const orderNumber = ref('');

const form = reactive({
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerAddress: '',
  message: '',
});

const fieldErrors = reactive({
  customerName: '',
  customerEmail: '',
  customerAddress: '',
});

function priceFormatted(cents: number): string {
  return formatPrice(cents);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validate(): boolean {
  let valid = true;
  fieldErrors.customerName = '';
  fieldErrors.customerEmail = '';
  fieldErrors.customerAddress = '';

  if (!form.customerName.trim()) {
    fieldErrors.customerName = 'Bitte geben Sie Ihren Namen ein.';
    valid = false;
  }

  if (!form.customerEmail.trim()) {
    fieldErrors.customerEmail = 'Bitte geben Sie Ihre E-Mail-Adresse ein.';
    valid = false;
  } else if (!validateEmail(form.customerEmail)) {
    fieldErrors.customerEmail = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    valid = false;
  }

  if (!form.customerAddress.trim()) {
    fieldErrors.customerAddress = 'Bitte geben Sie Ihre Adresse ein.';
    valid = false;
  }

  return valid;
}

async function handleSubmit() {
  error.value = '';

  if (!validate()) return;

  if (items.value.length === 0) {
    error.value = 'Ihr Warenkorb ist leer.';
    return;
  }

  loading.value = true;

  try {
    const orderItems = items.value.map((item) => ({
      productName: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
    }));

    const result = await submitOrder({
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim(),
      customerPhone: form.customerPhone.trim() || undefined,
      customerAddress: form.customerAddress.trim(),
      message: form.message.trim() || undefined,
      items: orderItems,
      totalAmount: total.value,
    });

    orderNumber.value = result.data?.orderNumber || result.data?.id?.toString() || '';
    orderComplete.value = true;
    clearCart();
  } catch (err: any) {
    error.value = err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  } finally {
    loading.value = false;
  }
}
</script>
