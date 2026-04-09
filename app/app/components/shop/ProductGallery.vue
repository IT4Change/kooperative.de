<template>
  <div
    class="relative aspect-[4/3] overflow-hidden bg-gray-100"
    :class="size === 'lg' ? 'rounded-lg' : 'rounded-t-lg'"
  >
    <img
      v-if="images.length > 0"
      :src="images[currentIndex]"
      :alt="`Bild ${currentIndex + 1} von ${images.length}`"
      class="w-full h-full object-contain"
      loading="lazy"
    />
    <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
      <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    </div>

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
  images: readonly string[]
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
