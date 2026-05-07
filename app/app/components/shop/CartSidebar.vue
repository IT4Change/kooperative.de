<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="isOpen" class="fixed inset-0 z-[200] flex justify-end" @click.self="closeCart">
        <div class="absolute inset-0 bg-black/40" @click="closeCart" />
        <Transition name="slide">
          <div v-if="isOpen" class="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold">
                <template v-if="checkoutStep === 'cart'">Bestellliste</template>
                <template v-else-if="checkoutStep === 'auth'">Anmelden</template>
                <template v-else-if="checkoutStep === 'details'">Versand &amp; Zahlung</template>
                <template v-else-if="checkoutStep === 'confirm'">Übersicht</template>
                <template v-else>Bestellung gesendet</template>
              </h2>
              <button
                class="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Schließen"
                @click="closeCart"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto px-5 py-4">
              <!-- Cart Step -->
              <template v-if="checkoutStep === 'cart'">
                <template v-if="isEmpty">
                  <p class="text-gray-400 text-center py-12">Deine Bestellliste ist leer.</p>
                </template>
                <template v-else>
                  <ShopCartItem
                    v-for="item in items"
                    :key="`${item.product.id}-${item.variantIndex ?? 'base'}`"
                    :item="item"
                    @update="updateQuantity"
                    @remove="removeFromCart"
                    @update-variant="updateVariant"
                  />
                </template>
              </template>

              <!-- Auth Step -->
              <ShopCheckoutLogin
                v-if="checkoutStep === 'auth'"
                @back="goToCart"
                @success="goToDetails"
              />

              <!-- Details Step (Versand + Zahlung + Anmerkungen) -->
              <ShopCheckoutDetails
                v-if="checkoutStep === 'details'"
                :shipping="shippingMethod"
                :payment="paymentMethod"
                :notes="orderNotes"
                :account-holder="bankAccountHolder"
                :iban="bankIban"
                @update:shipping="shippingMethod = $event"
                @update:payment="paymentMethod = $event"
                @update:notes="orderNotes = $event"
                @update:account-holder="bankAccountHolder = $event"
                @update:iban="bankIban = $event"
                @back="goToCart"
                @next="goToConfirm"
              />

              <!-- Confirm Step -->
              <ShopCheckoutConfirm
                v-if="checkoutStep === 'confirm'"
                :items="items"
                :total-price="totalPrice"
                :shipping="shippingMethod"
                :payment="paymentMethod"
                :iban="bankIban"
                :notes="orderNotes"
                :submitting="submitting"
                :submit-error="submitError"
                @back="goToDetails"
                @send="submitOrder"
              />

              <!-- Success Step -->
              <div v-if="checkoutStep === 'success'" class="text-center py-8">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00af8c]/10 flex items-center justify-center">
                  <svg class="w-8 h-8 text-[#00af8c]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold mb-2">Vielen Dank!</h3>
                <p class="text-sm text-gray-600 mb-1">Deine Bestellung wurde erfasst<span v-if="lastOrderId"> (Nr. {{ lastOrderId }})</span>.</p>
                <p class="text-sm text-gray-600 mb-6">Wir melden uns per E-Mail.</p>
                <KoopButton size="sm" @click="closeCart">Schließen</KoopButton>
              </div>
            </div>

            <!-- Footer (cart step only) -->
            <div v-if="checkoutStep === 'cart' && !isEmpty" class="border-t border-gray-200 px-5 py-4">
              <div class="flex justify-between text-sm font-bold mb-3">
                <span>Gesamt</span>
                <span>{{ totalPrice.toFixed(2) }} €</span>
              </div>
              <div class="flex justify-center">
                <KoopButton @click="onProceed">Zur Bestellung</KoopButton>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const {
  items,
  isOpen,
  checkoutStep,
  orderNotes,
  shippingMethod,
  paymentMethod,
  bankAccountHolder,
  bankIban,
  totalPrice,
  isEmpty,
  submitting,
  submitError,
  lastOrderId,
  closeCart,
  goToAuth,
  goToDetails,
  goToConfirm,
  goToCart,
  updateQuantity,
  removeFromCart,
  updateVariant,
  submitOrder,
} = useCart()

const { user } = useAuth()

function onProceed() {
  if (user.value) {
    goToDetails()
  } else {
    goToAuth()
  }
}
</script>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.3s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
