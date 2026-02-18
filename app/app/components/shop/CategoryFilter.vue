<template>
  <div class="flex flex-wrap gap-2">
    <button
      class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
      :class="selected === null
        ? 'bg-[#4a7c59] text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      @click="$emit('select', null)"
    >
      Alle
      <span class="ml-1 opacity-70">{{ totalCount }}</span>
    </button>
    <button
      v-for="cat in categories"
      :key="cat.slug"
      class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
      :disabled="!counts[cat.slug]"
      :class="!counts[cat.slug]
        ? 'bg-gray-50 text-gray-300 cursor-default'
        : selected === cat.slug
          ? 'bg-[#4a7c59] text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      @click="counts[cat.slug] && $emit('select', cat.slug)"
    >
      {{ cat.name }}
      <span class="ml-1 opacity-70">{{ counts[cat.slug] || 0 }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CategorySlug } from '~/data/products'
import { categories } from '~/data/products'

const props = defineProps<{
  selected: CategorySlug | null
  counts: Record<string, number>
}>()

defineEmits<{
  select: [value: CategorySlug | null]
}>()

const totalCount = computed(() =>
  Object.values(props.counts).reduce((sum, n) => sum + n, 0),
)
</script>
