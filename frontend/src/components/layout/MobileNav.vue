<template>
  <div>
    <!-- Hamburger Button -->
    <button
      type="button"
      class="inline-flex items-center justify-center w-10 h-10 rounded-md text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
      :aria-expanded="isOpen"
      aria-controls="mobile-nav-panel"
      aria-label="Menü öffnen"
      @click="toggle"
    >
      <svg
        v-if="!isOpen"
        class="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
      <svg
        v-else
        class="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Backdrop -->
    <Transition name="backdrop">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40 bg-black/30"
        @click="close"
      />
    </Transition>

    <!-- Slide-out Panel -->
    <Transition name="slide">
      <nav
        v-if="isOpen"
        id="mobile-nav-panel"
        class="fixed top-0 right-0 z-50 h-full w-72 max-w-[80vw] bg-white shadow-xl overflow-y-auto"
        aria-label="Mobile Navigation"
      >
        <!-- Panel Header -->
        <div class="flex items-center justify-between px-4 h-16 border-b border-gray-100">
          <span class="font-serif font-bold text-primary-800">Menü</span>
          <button
            type="button"
            class="inline-flex items-center justify-center w-10 h-10 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Menü schließen"
            @click="close"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Main Navigation Links -->
        <div class="px-4 py-4">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Bereiche
          </p>
          <ul class="space-y-1">
            <li v-for="item in mainLinks" :key="item.href">
              <a
                :href="item.href"
                class="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors no-underline"
                @click="close"
              >
                {{ item.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Divider -->
        <hr class="mx-4 border-gray-100" />

        <!-- Info Navigation Links -->
        <div class="px-4 py-4">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Informationen
          </p>
          <ul class="space-y-1">
            <li v-for="item in infoLinks" :key="item.href">
              <a
                :href="item.href"
                class="block px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors no-underline"
                @click="close"
              >
                {{ item.label }}
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
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

const mainLinks = [
  { label: 'Arbeit', href: '/arbeit' },
  { label: 'Kultur', href: '/kultur' },
  { label: 'Bildung', href: '/bildung' },
  { label: 'Gäste', href: '/gaeste' },
  { label: 'Bestellung', href: '/bestellung' },
  { label: 'Kalender', href: '/kalender' },
];

const infoLinks = [
  { label: 'Historie', href: '/historie' },
  { label: 'Kontakt', href: '/kontakt' },
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutz', href: '/datenschutz' },
];
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
