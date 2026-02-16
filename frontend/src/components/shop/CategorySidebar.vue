<template>
  <nav aria-label="Produktkategorien">
    <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
      Kategorien
    </h2>

    <ul class="space-y-1">
      <!-- All Products -->
      <li>
        <a
          href="/bestellung"
          :class="[
            'block px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline',
            !activeCategory
              ? 'bg-primary-50 text-primary-800'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          ]"
        >
          Alle Produkte
        </a>
      </li>

      <!-- Categories -->
      <li v-for="category in parsedCategories" :key="category.slug">
        <button
          type="button"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
            activeCategory === category.slug
              ? 'bg-primary-50 text-primary-800'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          ]"
          @click="toggleCategory(category.slug)"
        >
          <a
            :href="`/bestellung/${category.slug}`"
            class="flex-1 no-underline"
            :class="[
              activeCategory === category.slug
                ? 'text-primary-800'
                : 'text-gray-600 hover:text-gray-900',
            ]"
            @click.stop
          >
            {{ category.name }}
          </a>
          <svg
            v-if="category.subcategories && category.subcategories.length > 0"
            :class="[
              'w-4 h-4 shrink-0 transition-transform duration-200',
              expandedCategories.has(category.slug) ? 'rotate-90' : '',
            ]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <!-- Subcategories -->
        <Transition name="expand">
          <ul
            v-if="category.subcategories && category.subcategories.length > 0 && expandedCategories.has(category.slug)"
            class="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3"
          >
            <li v-for="sub in category.subcategories" :key="sub.slug">
              <a
                :href="`/bestellung/${category.slug}/${sub.slug}`"
                :class="[
                  'block px-3 py-1.5 rounded-md text-sm transition-colors no-underline',
                  activeSubcategory === sub.slug
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                ]"
              >
                {{ sub.name }}
              </a>
            </li>
          </ul>
        </Transition>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface Subcategory {
  name: string;
  slug: string;
}

interface Category {
  name: string;
  slug: string;
  subcategories: Subcategory[];
}

const props = defineProps<{
  categories: string;
  activeCategory?: string;
  activeSubcategory?: string;
}>();

const parsedCategories = computed<Category[]>(() => {
  try {
    return JSON.parse(props.categories);
  } catch {
    return [];
  }
});

const expandedCategories = ref<Set<string>>(new Set());

function toggleCategory(slug: string) {
  if (expandedCategories.value.has(slug)) {
    expandedCategories.value.delete(slug);
  } else {
    expandedCategories.value.add(slug);
  }
  // Trigger reactivity
  expandedCategories.value = new Set(expandedCategories.value);
}

onMounted(() => {
  // Auto-expand the active category
  if (props.activeCategory) {
    expandedCategories.value.add(props.activeCategory);
    expandedCategories.value = new Set(expandedCategories.value);
  }
});
</script>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
