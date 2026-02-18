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
    </button>
    <button
      v-for="cat in categories"
      :key="cat.slug"
      class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
      :class="selected === cat.slug
        ? 'bg-[#4a7c59] text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      @click="$emit('select', cat.slug)"
    >
      {{ cat.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CategorySlug } from '~/data/products'
import { categories } from '~/data/products'

defineProps<{
  selected: CategorySlug | null
}>()

defineEmits<{
  select: [value: CategorySlug | null]
}>()
</script>
