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
                <template v-if="checkoutStep === 'cart'">Warenkorb</template>
                <template v-else-if="checkoutStep === 'form'">Bestellung</template>
                <template v-else>Übersicht</template>
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
                  <p class="text-gray-400 text-center py-12">Dein Warenkorb ist leer.</p>
                </template>
                <template v-else>
                  <ShopCartItem
                    v-for="item in items"
                    :key="item.product.id"
                    :item="item"
                    @update="updateQuantity"
                    @remove="removeFromCart"
                  />
                </template>
              </template>

              <!-- Form Step -->
              <ShopCheckoutForm
                v-if="checkoutStep === 'form'"
                :form-data="orderFormData"
                @submit="goToConfirm"
                @back="goToCart"
              />

              <!-- Confirm Step -->
              <ShopCheckoutConfirm
                v-if="checkoutStep === 'confirm'"
                :items="items"
                :total-price="totalPrice"
                :form-data="orderFormData"
                :mailto-link="generateMailtoLink()"
                @back="goToForm"
                @send="onSend"
              />
            </div>

            <!-- Footer (cart step only) -->
            <div v-if="checkoutStep === 'cart' && !isEmpty" class="border-t border-gray-200 px-5 py-4">
              <div class="flex justify-between text-sm font-bold mb-3">
                <span>Gesamt</span>
                <span>{{ totalPrice.toFixed(2) }} €</span>
              </div>
              <button
                class="w-full py-2.5 bg-[#4a7c59] text-white rounded hover:bg-[#3d6a4a] transition-colors font-medium"
                @click="goToForm"
              >
                Zur Bestellung
              </button>
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
  orderFormData,
  totalPrice,
  isEmpty,
  closeCart,
  goToForm,
  goToConfirm,
  goToCart,
  updateQuantity,
  removeFromCart,
  generateMailtoLink,
  clearCart,
} = useCart()

function onSend() {
  clearCart()
  closeCart()
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
