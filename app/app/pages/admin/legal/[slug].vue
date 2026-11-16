<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <NuxtLink to="/admin/legal" class="text-sm text-gray-600 hover:text-[#007a62]"
        >← Rechtstexte</NuxtLink
      >
      <h2 class="text-lg font-semibold text-gray-800">{{ page?.title ?? 'Unbekannte Seite' }}</h2>
      <a
        v-if="page"
        :href="page.path"
        target="_blank"
        rel="noopener"
        class="ml-auto text-sm text-gray-600 underline hover:text-[#007a62]"
        >Live-Fassung im Shop ansehen</a
      >
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 border border-red-200 rounded p-4 text-sm">
      Fehler beim Laden: {{ error.statusMessage || error.message }}
    </div>

    <p
      v-if="message"
      class="rounded p-3 text-sm border"
      :class="
        messageIsError
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-green-50 text-green-800 border-green-200'
      "
      role="status"
    >
      {{ message }}
    </p>

    <!-- Activation needs a second, deliberate click: it changes both shops at once. -->
    <div
      v-if="confirming"
      class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm space-y-3"
      data-testid="activate-confirm"
    >
      <p class="font-medium text-amber-900">
        Version v{{ confirming.versionNo }} live schalten? Sie gilt sofort im neuen Shop und im
        Altshop.
      </p>
      <p v-if="confirming.placeholders > 0" class="text-amber-900">
        Achtung: Diese Version enthält noch
        {{
          confirming.placeholders === 1
            ? 'einen offenen Platzhalter'
            : `${confirming.placeholders} offene Platzhalter`
        }}
        ([[…]]). Sie würden für Kunden sichtbar gelb markiert erscheinen.
      </p>
      <label v-if="confirming.placeholders > 0" class="flex items-center gap-2 text-amber-900">
        <input v-model="acceptPlaceholders" type="checkbox" class="rounded border-amber-400" />
        Trotzdem mit offenen Platzhaltern live schalten
      </label>
      <div class="flex gap-2">
        <button
          type="button"
          class="px-3 py-1.5 bg-[#00af8c] text-white rounded text-sm hover:bg-[#009579] disabled:opacity-40"
          :disabled="busy || (confirming.placeholders > 0 && !acceptPlaceholders)"
          data-testid="activate-yes"
          @click="activate(confirming)"
        >
          Ja, live schalten
        </button>
        <button
          type="button"
          class="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
          @click="confirming = null"
        >
          Abbrechen
        </button>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-[300px_1fr]">
      <!-- Versions -->
      <aside class="bg-white rounded-lg shadow-sm border border-gray-200 self-start">
        <h3 class="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase border-b">Versionen</h3>
        <ul class="divide-y divide-gray-100" data-testid="versions">
          <li
            v-for="v in data?.versions ?? []"
            :key="v.id"
            class="px-4 py-3 text-sm"
            :class="v.id === selectedId ? 'bg-[#00af8c]/10' : ''"
          >
            <button type="button" class="w-full text-left" @click="select(v.id)">
              <span class="font-semibold">v{{ v.versionNo }}</span>
              <span
                v-if="v.live"
                class="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700"
                >live</span
              >
              <span
                v-if="v.placeholders > 0"
                class="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800"
                :title="`${v.placeholders} offene Platzhalter`"
                >{{ v.placeholders }} [[…]]</span
              >
              <span class="block text-xs text-gray-600 mt-0.5"
                >{{ dateTime(v.createdAt) }} · {{ v.createdBy }}</span
              >
              <span
                v-if="v.note"
                class="block text-xs text-gray-600 mt-1"
                data-testid="version-note"
                >{{ v.note }}</span
              >
            </button>
            <button
              v-if="!v.live"
              type="button"
              class="mt-2 px-2 py-1 text-xs border border-[#00af8c] text-[#007a62] rounded hover:bg-[#00af8c]/10"
              :data-testid="`activate-${v.id}`"
              @click="askActivate(v)"
            >
              Live schalten
            </button>
          </li>
          <li v-if="data && data.versions.length === 0" class="px-4 py-6 text-sm text-gray-600">
            Noch keine Version gespeichert.
          </li>
        </ul>
      </aside>

      <!-- Editor -->
      <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3 min-w-0">
        <h3 class="text-sm font-medium text-gray-700">
          <template v-if="base">Neue Version auf Basis von v{{ base.versionNo }}</template>
          <template v-else>Neue Version</template>
          <span v-if="dirty" class="ml-2 text-xs font-normal text-amber-700">ungespeichert</span>
        </h3>

        <AdminMarkdownEditor v-model="draft" @placeholders="draftPlaceholders = $event" />

        <p
          v-if="draftPlaceholders.length"
          class="text-xs text-amber-800"
          data-testid="open-placeholders"
        >
          Offene Platzhalter: {{ draftPlaceholders.join(' · ') }}
        </p>

        <div class="flex flex-wrap items-end gap-3">
          <label class="flex-1 min-w-[240px] text-sm text-gray-600">
            Notiz zur Änderung
            <input
              v-model="note"
              type="text"
              maxlength="500"
              placeholder="z. B. Hosting-Anbieter ergänzt"
              class="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
            />
          </label>
          <button
            type="button"
            class="px-4 py-2 bg-[#00af8c] text-white rounded text-sm hover:bg-[#009579] disabled:opacity-40"
            :disabled="busy || !dirty || !draft.trim()"
            data-testid="save"
            @click="save"
          >
            Als neue Version speichern
          </button>
        </div>
        <p class="text-xs text-gray-500">
          Speichern legt eine neue Version an und schaltet sie noch nicht live.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { isLegalSlug, legalPage } from '~/data/legalPages'

  definePageMeta({ layout: 'admin' })

  interface VersionSummary {
    id: number
    versionNo: number
    note: string
    createdBy: string
    createdAt: string
    live: boolean
    placeholders: number
  }

  interface VersionDetail extends VersionSummary {
    bodyMd: string
  }

  const route = useRoute()
  const slug = String(route.params.slug)
  const page = isLegalSlug(slug) ? legalPage(slug) : null
  useHead({ title: `${page?.title ?? 'Rechtstexte'} – Admin` })

  const { dateTime, errorMessage } = useAdminFormat()
  const { data, error, refresh } = await useFetch<{ versions: VersionSummary[] }>(
    `/admin/api/legal/${slug}`,
  )

  const selectedId = ref<number | null>(null)
  const base = ref<VersionDetail | null>(null)
  const draft = ref('')
  const note = ref('')
  const draftPlaceholders = ref<string[]>([])
  const dirty = computed(() => draft.value !== (base.value?.bodyMd ?? ''))

  const busy = ref(false)
  const message = ref('')
  const messageIsError = ref(false)
  const confirming = ref<VersionSummary | null>(null)
  const acceptPlaceholders = ref(false)

  function report(text: string, isError = false) {
    message.value = text
    messageIsError.value = isError
  }

  async function load(id: number) {
    try {
      const v = await $fetch<VersionDetail>(`/admin/api/legal/${slug}/versions/${id}`)
      selectedId.value = id
      base.value = v
      draft.value = v.bodyMd
      note.value = ''
    } catch (err) {
      report(`Version konnte nicht geladen werden: ${errorMessage(err)}`, true)
    }
  }

  async function select(id: number) {
    if (id === selectedId.value) return
    if (dirty.value && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return
    await load(id)
  }

  async function save() {
    busy.value = true
    try {
      const res = await $fetch<{ id: number; versionNo: number }>(
        `/admin/api/legal/${slug}/versions`,
        { method: 'POST', body: { bodyMd: draft.value, note: note.value } },
      )
      report(`Version v${res.versionNo} gespeichert. Sie ist noch nicht live.`)
      await refresh()
      await load(res.id)
    } catch (err) {
      report(`Speichern fehlgeschlagen: ${errorMessage(err)}`, true)
    } finally {
      busy.value = false
    }
  }

  function askActivate(v: VersionSummary) {
    acceptPlaceholders.value = false
    confirming.value = v
  }

  async function activate(v: VersionSummary) {
    busy.value = true
    try {
      await $fetch(`/admin/api/legal/${slug}/versions/${v.id}/activate`, { method: 'POST' })
      report(`Version v${v.versionNo} ist jetzt live – im neuen Shop und im Altshop.`)
      confirming.value = null
      await refresh()
    } catch (err) {
      report(`Live schalten fehlgeschlagen: ${errorMessage(err)}`, true)
    } finally {
      busy.value = false
    }
  }

  // Start with the newest version in the editor — usually the one being worked on.
  onMounted(() => {
    const newest = data.value?.versions[0]
    if (newest) void load(newest.id)
  })
</script>
