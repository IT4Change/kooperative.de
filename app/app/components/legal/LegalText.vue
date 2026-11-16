<template>
  <div>
    <!-- No loading state: setup awaits the fetch, and the dialog shows its own
         Suspense fallback while a tab loads. -->
    <p v-if="error || !data?.html" class="text-sm text-gray-600" data-testid="legal-unavailable">
      Dieser Text ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.
    </p>
    <!-- The HTML is rendered and made safe on the server (server/utils/legalMarkdown.ts):
         markdown-it with raw HTML and images disabled, links scheme-checked. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="legal-content" data-testid="legal-content" v-html="data.html" />
  </div>
</template>

<script setup lang="ts">
  import type { LegalSlug } from '~/data/legalPages'

  interface LegalTextResponse {
    slug: LegalSlug
    title: string
    html: string | null
    versionNo: number | null
    activatedAt: string | null
  }

  const props = defineProps<{ slug: LegalSlug }>()

  // The slug is fixed for the life of the component — the dialog remounts it
  // (:key) when the tab changes — so a plain URL is enough.
  const { data, error } = await useFetch<LegalTextResponse>(`/api/legal/${props.slug}`)
</script>
