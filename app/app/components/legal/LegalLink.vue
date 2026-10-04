<template>
  <a :href="page.path" @click="onClick"
    ><slot>{{ page.label }}</slot></a
  >
</template>

<script setup lang="ts">
  import type { LegalSlug } from '~/data/legalPages'

  import { legalPage } from '~/data/legalPages'

  /**
   * A link to a legal page that opens it in the legal dialog instead of leaving
   * the current page — the cart, a half-filled checkout and the scroll position
   * all stay where they are. It is still a real link to the standalone page, so
   * it works without JavaScript, can be opened in a new tab and copied.
   */
  const props = defineProps<{ slug: LegalSlug }>()
  const emit = defineEmits<{ open: [] }>()

  const page = computed(() => legalPage(props.slug))
  const { open } = useLegal()

  function onClick(event: MouseEvent) {
    // Ctrl/Cmd/Shift-click and middle click keep their browser meaning.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    open(props.slug)
    emit('open')
  }
</script>
