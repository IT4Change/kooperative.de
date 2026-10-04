<template>
  <div class="min-h-screen pt-24 pb-16 px-4 sm:px-6" style="background-color: var(--koop-orange)">
    <article
      class="max-w-[960px] mx-auto bg-white/95 rounded-2xl shadow-lg px-6 py-10 sm:px-10 sm:py-12"
    >
      <h1 class="text-3xl sm:text-4xl font-bold mb-8">{{ page.title }}</h1>
      <LegalText :slug="slug" />
      <nav
        aria-label="Weitere rechtliche Seiten"
        class="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-x-5 gap-y-2 text-sm"
      >
        <NuxtLink
          v-for="other in others"
          :key="other.slug"
          :to="other.path"
          class="underline text-gray-600 hover:text-[#00af8c]"
          >{{ other.label }}</NuxtLink
        >
      </nav>
    </article>
  </div>
</template>

<script setup lang="ts">
  import type { LegalSlug } from '~/data/legalPages'

  import { LEGAL_PAGES, legalPage } from '~/data/legalPages'

  /**
   * A legal page on its own URL (/impressum, /datenschutz, …). Inside the app the
   * links open the legal dialog instead; this is what direct links, search
   * engines and the browser without JavaScript get.
   */
  const props = defineProps<{ slug: LegalSlug }>()

  const page = computed(() => legalPage(props.slug))
  const others = computed(() => LEGAL_PAGES.filter((p) => p.slug !== props.slug))

  useHead({
    title: () => `${page.value.title} – Kooperative Dürnau`,
    meta: [{ name: 'description', content: () => page.value.description }],
  })
</script>
