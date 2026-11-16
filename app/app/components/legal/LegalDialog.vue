<template>
  <Teleport to="body">
    <div v-if="current" class="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-6">
      <div class="absolute inset-0 bg-black/50" @click="close" />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${uid}-title`"
        tabindex="-1"
        class="relative bg-white rounded-xl shadow-2xl w-full max-w-[960px] max-h-[92vh] flex flex-col focus:outline-none"
      >
        <div class="shrink-0 flex items-center gap-3 px-5 pt-4 sm:px-8 sm:pt-6">
          <h2 :id="`${uid}-title`" class="text-xl sm:text-2xl font-bold flex-1">Rechtliches</h2>
          <button
            type="button"
            class="w-9 h-9 rounded-full text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Schließen"
            @click="close"
          >
            ×
          </button>
        </div>

        <!-- Sub-navigation: one tab per legal page (WAI-ARIA tabs pattern). -->
        <div
          role="tablist"
          aria-label="Rechtliche Seiten"
          class="shrink-0 flex gap-1 overflow-x-auto px-5 sm:px-8 mt-3 border-b border-gray-200"
          @keydown="onTabKey"
        >
          <button
            v-for="page in LEGAL_PAGES"
            :id="`${uid}-tab-${page.slug}`"
            :key="page.slug"
            ref="tabs"
            type="button"
            role="tab"
            :aria-selected="page.slug === current"
            :aria-controls="`${uid}-panel`"
            :tabindex="page.slug === current ? 0 : -1"
            class="shrink-0 px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors"
            :class="
              page.slug === current
                ? 'border-[#00af8c] text-[#007a62] font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            "
            @click="open(page.slug)"
          >
            {{ page.label }}
          </button>
        </div>

        <div
          :id="`${uid}-panel`"
          role="tabpanel"
          :aria-labelledby="`${uid}-tab-${current}`"
          class="overflow-y-auto px-5 py-5 sm:px-8 sm:py-6"
        >
          <h3 class="text-2xl font-bold mb-5">{{ legalPage(current).title }}</h3>
          <Suspense>
            <LegalText :key="current" :slug="current" />
            <template #fallback>
              <p class="text-sm text-gray-500">Lädt…</p>
            </template>
          </Suspense>
        </div>

        <div
          class="shrink-0 flex justify-end px-5 py-3 sm:px-8 border-t border-gray-200 text-sm text-gray-600"
        >
          <NuxtLink
            :to="legalPage(current).path"
            class="underline hover:text-[#00af8c]"
            @click="close"
            >Als eigene Seite öffnen</NuxtLink
          >
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { LEGAL_PAGES, legalPage } from '~/data/legalPages'

  /**
   * "Rechtliches": Impressum, Datenschutz, AGB, Widerruf, Versand & Zahlung in one
   * dialog with a tab per page. Opened through useLegal() — every LegalLink in
   * the app lands here on its own tab.
   */
  const { current, isOpen, open, close } = useLegal()
  const uid = useId()
  const panel = ref<HTMLElement>()
  const tabs = ref<HTMLButtonElement[]>([])

  useModal(isOpen, panel, close)

  // On a phone the tab bar scrolls sideways; keep the selected tab in view, also
  // when the dialog opens straight on one of the last pages.
  watch(current, async (slug) => {
    if (!slug) return
    await nextTick()
    const index = LEGAL_PAGES.findIndex((p) => p.slug === slug)
    tabs.value[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  /** Arrow keys, Home and End move between tabs, as the tabs pattern expects. */
  function onTabKey(event: KeyboardEvent) {
    const index = LEGAL_PAGES.findIndex((p) => p.slug === current.value)
    const last = LEGAL_PAGES.length - 1
    const target = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    open(LEGAL_PAGES[target].slug)
    tabs.value[target]?.focus()
  }
</script>
