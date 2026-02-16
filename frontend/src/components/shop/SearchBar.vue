<template>
  <div class="relative" ref="containerRef">
    <!-- Search Input -->
    <div class="relative">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
      <input
        v-model="query"
        type="text"
        placeholder="Produkt suchen..."
        class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        @input="onInput"
        @focus="showResults = results.length > 0 || (query.length >= 2)"
      />
      <button
        v-if="query.length > 0"
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Suche leeren"
        @click="clearSearch"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Results Dropdown -->
    <div
      v-if="showResults && query.length >= 2"
      class="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto"
    >
      <ul v-if="results.length > 0" class="py-1">
        <li v-for="result in results" :key="result.item.slug">
          <a
            :href="`/bestellung/produkt/${result.item.slug}`"
            class="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-800 transition-colors no-underline"
          >
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ result.item.name }}</div>
              <div class="text-xs text-gray-400 mt-0.5">
                <span v-if="result.item.categoryName">{{ result.item.categoryName }}</span>
                <span v-if="result.item.categoryName && result.item.subcategoryName"> / </span>
                <span v-if="result.item.subcategoryName">{{ result.item.subcategoryName }}</span>
                <span v-if="result.item.sku" class="ml-2 text-gray-300">{{ result.item.sku }}</span>
              </div>
            </div>
            <svg class="w-4 h-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        </li>
      </ul>
      <div v-else class="px-4 py-6 text-center text-sm text-gray-400">
        Keine Ergebnisse
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Fuse from 'fuse.js';

interface ProductSearch {
  name: string;
  slug: string;
  sku: string;
  categoryName: string;
  subcategoryName: string;
}

const props = defineProps<{
  products: string;
}>();

const query = ref('');
const results = ref<Fuse.FuseResult<ProductSearch>[]>([]);
const showResults = ref(false);
const containerRef = ref<HTMLElement | null>(null);

let fuse: Fuse<ProductSearch> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  try {
    const parsed: ProductSearch[] = JSON.parse(props.products);
    fuse = new Fuse(parsed, {
      keys: ['name', 'sku', 'categoryName', 'subcategoryName'],
      threshold: 0.4,
      includeScore: true,
    });
  } catch {
    fuse = null;
  }

  document.addEventListener('click', onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
  if (debounceTimer) clearTimeout(debounceTimer);
});

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    search();
  }, 200);
}

function search() {
  if (!fuse || query.value.length < 2) {
    results.value = [];
    showResults.value = false;
    return;
  }

  results.value = fuse.search(query.value, { limit: 10 });
  showResults.value = true;
}

function clearSearch() {
  query.value = '';
  results.value = [];
  showResults.value = false;
}

function onClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    showResults.value = false;
  }
}
</script>
