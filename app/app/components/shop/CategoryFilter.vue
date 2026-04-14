<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="selected === null
          ? 'bg-[#00af8c] text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        @click="$emit('select', null)"
      >
        Alle
        <span class="ml-1 opacity-70">{{ totalCount }}</span>
      </button>
      <button
        v-for="cat in topLevel"
        :key="cat.slug"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :disabled="!counts[cat.slug]"
        :class="[
          !counts[cat.slug]
            ? 'bg-gray-50 text-gray-300 cursor-default'
            : isSelected(cat.slug)
              ? 'bg-[#00af8c] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          cat.slug === 'lebensmittel' ? 'line-through' : '',
        ]"
        @click="counts[cat.slug] && $emit('select', cat.slug)"
      >
        {{ cat.name }}
        <span class="ml-1 opacity-70">{{ counts[cat.slug] || 0 }}</span>
      </button>
    </div>
    <div v-if="children.length" class="flex flex-wrap gap-2 pl-3 border-l-2 border-[#00af8c]/30">
      <button
        v-for="cat in children"
        :key="cat.slug"
        class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
        :disabled="!counts[cat.slug]"
        :class="!counts[cat.slug]
          ? 'bg-gray-50 text-gray-300 cursor-default'
          : selected === cat.slug
            ? 'bg-[#00af8c] text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        @click="counts[cat.slug] && $emit('select', cat.slug)"
      >
        {{ cat.name }}
        <span class="ml-1 opacity-70">{{ counts[cat.slug] || 0 }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CategorySlug, Category } from '~/data/products'

const props = defineProps<{
  selected: CategorySlug | null
  counts: Record<string, number>
  categories: Category[]
  total: number
}>()

defineEmits<{
  select: [value: CategorySlug | null]
}>()

const totalCount = computed(() => props.total)

const topLevel = computed(() => props.categories.filter(c => c.parentSlug === null))

const selectedTopLevel = computed(() => {
  if (!props.selected) return null
  const idx = props.selected.indexOf('/')
  return idx === -1 ? props.selected : props.selected.slice(0, idx)
})

function isSelected(slug: string) {
  return props.selected === slug || selectedTopLevel.value === slug
}

const children = computed(() => {
  if (!selectedTopLevel.value) return []
  return props.categories.filter(c => c.parentSlug === selectedTopLevel.value)
})
</script>
