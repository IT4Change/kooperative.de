<template>
  <div
    class="relative aspect-[4/3] overflow-hidden bg-gray-100"
    :class="size === 'lg' ? 'rounded-lg' : 'rounded-t-lg'"
  >
    <img
      :src="images[currentIndex]"
      :alt="`Bild ${currentIndex + 1} von ${images.length}`"
      class="w-full h-full object-cover"
      loading="lazy"
    />

    <!-- Prev -->
    <button
      v-if="images.length > 1"
      class="absolute top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
      :class="size === 'lg' ? 'left-2.5 w-9 h-9' : 'left-1.5 w-7 h-7'"
      @click.stop="prev"
      aria-label="Vorheriges Bild"
    >
      <svg :class="size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <!-- Next -->
    <button
      v-if="images.length > 1"
      class="absolute top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
      :class="size === 'lg' ? 'right-2.5 w-9 h-9' : 'right-1.5 w-7 h-7'"
      @click.stop="next"
      aria-label="Nächstes Bild"
    >
      <svg :class="size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>

    <!-- Dots -->
    <div v-if="images.length > 1" class="absolute bottom-2 left-1/2 -translate-x-1/2 flex" :class="size === 'lg' ? 'gap-2' : 'gap-1.5'">
      <button
        v-for="(_, i) in images"
        :key="i"
        class="rounded-full transition-colors"
        :class="[
          size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2',
          i === currentIndex ? 'bg-white' : 'bg-white/50',
        ]"
        @click.stop="currentIndex = i"
        :aria-label="`Bild ${i + 1}`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  images: string[]
  size?: 'sm' | 'lg'
}>(), {
  size: 'sm',
})

const currentIndex = ref(0)

function prev() {
  currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length
}

function next() {
  currentIndex.value = (currentIndex.value + 1) % props.images.length
}
</script>
