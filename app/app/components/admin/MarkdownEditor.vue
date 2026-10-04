<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="flex flex-col min-w-0">
      <div
        role="toolbar"
        aria-label="Formatierung"
        class="flex flex-wrap gap-1 mb-2"
        data-testid="md-toolbar"
      >
        <button
          v-for="action in ACTIONS"
          :key="action.id"
          type="button"
          :title="action.title"
          :aria-label="action.title"
          class="px-2.5 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50"
          :class="action.class"
          :data-action="action.id"
          @click="apply(action.id)"
        >
          {{ action.label }}
        </button>
      </div>
      <textarea
        ref="textarea"
        :value="modelValue"
        aria-label="Text (Markdown)"
        spellcheck="true"
        lang="de"
        class="w-full min-h-[480px] flex-1 p-3 font-mono text-[13px] leading-relaxed border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
      <p class="mt-1.5 text-[11px] text-gray-500">
        ## Überschrift · ### Unterüberschrift · **fett** · - Liste · [Text](https://…) ·
        Zeilenumbruch = neue Zeile · Leerzeile = neuer Absatz · [[Platzhalter]] wird gelb markiert.
      </p>
    </div>

    <div class="min-w-0">
      <div class="flex items-center justify-between mb-2 h-[26px]">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Vorschau</span>
        <span v-if="previewError" class="text-xs text-red-600">{{ previewError }}</span>
      </div>
      <div
        class="border border-gray-200 rounded bg-white p-5 min-h-[480px] max-h-[70vh] overflow-y-auto"
      >
        <!-- Rendered by the server, exactly as saving would (see legalMarkdown.ts). -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="legal-content text-sm" data-testid="md-preview" v-html="previewHtml" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * A deliberately small Markdown editor: a textarea, a toolbar for the handful
   * of constructs a legal text needs, and a live preview. No editor library —
   * the preview is rendered by the same server code that renders on save, so
   * there is one Markdown dialect, not two that might disagree.
   */
  const props = defineProps<{ modelValue: string }>()
  const emit = defineEmits<{
    'update:modelValue': [value: string]
    placeholders: [list: string[]]
  }>()

  type ActionId = 'h2' | 'h3' | 'bold' | 'ul' | 'ol' | 'link' | 'placeholder'

  const ACTIONS: { id: ActionId; label: string; title: string; class?: string }[] = [
    { id: 'h2', label: 'Ü2', title: 'Überschrift', class: 'font-bold' },
    { id: 'h3', label: 'Ü3', title: 'Unterüberschrift', class: 'font-semibold' },
    { id: 'bold', label: 'F', title: 'Fett', class: 'font-bold' },
    { id: 'ul', label: '• Liste', title: 'Aufzählung' },
    { id: 'ol', label: '1. Liste', title: 'Nummerierte Liste' },
    { id: 'link', label: 'Link', title: 'Link einfügen' },
    { id: 'placeholder', label: '[[ ]]', title: 'Platzhalter einfügen' },
  ]

  const textarea = ref<HTMLTextAreaElement>()

  /** Replaces the selection, then selects `select` (offsets within the inserted text). */
  function replaceSelection(
    build: (selected: string) => { text: string; select: [number, number] },
  ) {
    const el = textarea.value!
    const { selectionStart: start, selectionEnd: end } = el
    const value = props.modelValue
    const { text, select } = build(value.slice(start, end))
    emit('update:modelValue', value.slice(0, start) + text + value.slice(end))
    void nextTick(() => {
      el.focus()
      el.setSelectionRange(start + select[0], start + select[1])
    })
  }

  /** Prefixes every line touched by the selection (headings, lists). */
  function prefixLines(prefix: (index: number) => string) {
    const el = textarea.value!
    const value = props.modelValue
    const lineStart = value.lastIndexOf('\n', el.selectionStart - 1) + 1
    const nextBreak = value.indexOf('\n', el.selectionEnd)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(lineStart, lineEnd).split('\n')
    // Strip an existing heading/list marker first, so Ü2 on an Ü3 line switches
    // the level instead of stacking "## ### ".
    const text = lines
      .map((line, i) => prefix(i) + line.replace(/^(#{1,6} |[-*] |\d+\. )/, ''))
      .join('\n')
    emit('update:modelValue', value.slice(0, lineStart) + text + value.slice(lineEnd))
    void nextTick(() => {
      el.focus()
      el.setSelectionRange(lineStart, lineStart + text.length)
    })
  }

  function apply(id: ActionId) {
    switch (id) {
      case 'h2': {
        prefixLines(() => '## ')
        return
      }
      case 'h3': {
        prefixLines(() => '### ')
        return
      }
      case 'ul': {
        prefixLines(() => '- ')
        return
      }
      case 'ol': {
        prefixLines((i) => `${i + 1}. `)
        return
      }
      case 'bold': {
        replaceSelection((s) => {
          const inner = s || 'fett'
          return { text: `**${inner}**`, select: [2, 2 + inner.length] }
        })
        return
      }
      case 'link': {
        replaceSelection((s) => {
          const label = s || 'Linktext'
          const text = `[${label}](https://)`
          // Select the URL part — that is what has to be typed next.
          return { text, select: [label.length + 3, text.length - 1] }
        })
        return
      }
      case 'placeholder': {
        replaceSelection((s) => {
          const inner = s || 'Angabe fehlt'
          return { text: `[[${inner}]]`, select: [2, 2 + inner.length] }
        })
      }
    }
  }

  // --- Preview ---------------------------------------------------------------

  const previewHtml = ref('')
  const previewError = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest = 0

  async function renderPreview(markdown: string) {
    const ticket = ++latest
    if (!markdown.trim()) {
      previewHtml.value = ''
      previewError.value = ''
      emit('placeholders', [])
      return
    }
    try {
      const res = await $fetch<{ html: string; placeholders: string[] }>(
        '/admin/api/legal/preview',
        { method: 'POST', body: { bodyMd: markdown } },
      )
      // An older request answering late must not overwrite a newer preview.
      if (ticket !== latest) return
      previewHtml.value = res.html
      previewError.value = ''
      emit('placeholders', res.placeholders)
    } catch {
      if (ticket !== latest) return
      previewError.value = 'Vorschau nicht verfügbar'
    }
  }

  watch(
    () => props.modelValue,
    (markdown) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void renderPreview(markdown)
      }, 300)
    },
  )
  onMounted(() => {
    void renderPreview(props.modelValue)
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
  })
</script>
