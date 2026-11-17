<template>
  <div class="min-h-screen pt-24 pb-16 px-4 sm:px-6" style="background-color: var(--koop-orange)">
    <article
      class="max-w-[720px] mx-auto bg-white/95 rounded-2xl shadow-lg px-6 py-10 sm:px-10 sm:py-12"
    >
      <template v-if="receivedAt">
        <h1 class="text-3xl font-bold mb-4">Widerruf eingegangen</h1>
        <p class="text-gray-700 mb-3" data-testid="withdrawal-received">
          Ihr Widerruf ist am {{ receivedAtText }} bei uns eingegangen.
        </p>
        <p class="text-gray-600">
          Eine Bestätigung mit dem Inhalt Ihrer Erklärung haben wir an
          <strong>{{ form.email }}</strong> geschickt. Wir melden uns zur Rücksendung und Erstattung
          bei Ihnen.
        </p>
      </template>

      <template v-else>
        <h1 class="text-3xl font-bold mb-4">Vertrag widerrufen</h1>
        <p class="text-gray-600 mb-6">
          Hiermit widerrufen Sie Ihren Kaufvertrag – für Bestellungen aus dem neuen wie aus dem
          alten Shop. Eine Begründung ist nicht nötig. Einzelheiten stehen in der
          <LegalLink slug="widerruf" class="underline hover:text-[#00af8c]"
            >Widerrufsbelehrung</LegalLink
          >.
        </p>

        <form class="space-y-4" novalidate @submit.prevent="submit">
          <div>
            <label :for="`${uid}-name`" class="block text-sm font-medium mb-1">Name</label>
            <input
              :id="`${uid}-name`"
              v-model="form.name"
              type="text"
              autocomplete="name"
              required
              maxlength="200"
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
            />
          </div>
          <div>
            <label :for="`${uid}-email`" class="block text-sm font-medium mb-1">
              E-Mail-Adresse <span class="font-normal text-gray-500">(für die Bestätigung)</span>
            </label>
            <input
              :id="`${uid}-email`"
              v-model="form.email"
              type="email"
              autocomplete="email"
              required
              maxlength="255"
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
            />
          </div>
          <div>
            <label :for="`${uid}-order`" class="block text-sm font-medium mb-1">
              Bestellnummer
              <span class="font-normal text-gray-500">(steht in Ihrer Eingangsbestätigung)</span>
            </label>
            <input
              :id="`${uid}-order`"
              v-model="form.orderRef"
              type="text"
              required
              maxlength="64"
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
            />
          </div>

          <fieldset>
            <legend class="block text-sm font-medium mb-1">Was widerrufen Sie?</legend>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.scope" type="radio" value="all" />
              die gesamte Bestellung
            </label>
            <label class="flex items-center gap-2 text-sm mt-1">
              <input v-model="form.scope" type="radio" value="partial" />
              nur einzelne Artikel
            </label>
          </fieldset>
          <div v-if="form.scope === 'partial'">
            <label :for="`${uid}-items`" class="block text-sm font-medium mb-1"
              >Welche Artikel?</label
            >
            <textarea
              :id="`${uid}-items`"
              v-model="form.items"
              rows="3"
              maxlength="2000"
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
            />
          </div>
          <div>
            <label :for="`${uid}-message`" class="block text-sm font-medium mb-1">
              Nachricht <span class="font-normal text-gray-500">(freiwillig)</span>
            </label>
            <textarea
              :id="`${uid}-message`"
              v-model="form.message"
              rows="3"
              maxlength="2000"
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00af8c]/40 focus:border-[#00af8c]"
            />
          </div>

          <p
            v-if="submitError"
            class="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
            role="alert"
          >
            {{ submitError }}
          </p>

          <KoopButton type="submit" :disabled="submitting">
            {{ submitting ? 'Sende…' : 'Widerruf bestätigen' }}
          </KoopButton>
        </form>
      </template>
    </article>
  </div>
</template>

<script setup lang="ts">
  /**
   * The withdrawal function (§ 356a BGB): the footer's "Vertrag widerrufen"
   * leads here, the confirmation button is "Widerruf bestätigen". No login —
   * a signed-in customer merely finds name and address filled in.
   */
  useHead({ title: 'Vertrag widerrufen – Kooperative Dürnau' })
  useSeoMeta({ robots: 'noindex' })

  const uid = useId()
  const route = useRoute()
  const { user } = useAuth()

  const prefillOrder = typeof route.query.bestellung === 'string' ? route.query.bestellung : ''
  const form = reactive({
    name: '',
    email: '',
    orderRef: /^\d{1,10}$/.test(prefillOrder) ? prefillOrder : '',
    scope: 'all',
    items: '',
    message: '',
  })
  // The session is often only known after the page has been set up (it is
  // fetched on the client); fill in what is still empty once it is there.
  watch(
    user,
    (u) => {
      if (!u) return
      form.name ||= `${u.firstname} ${u.lastname}`.trim()
      form.email ||= u.email
    },
    { immediate: true },
  )

  const submitting = ref(false)
  const submitError = ref('')
  const receivedAt = ref<string | null>(null)
  const receivedAtText = computed(() => {
    const d = new Date(receivedAt.value!)
    const opts = { timeZone: 'Europe/Berlin' } as const
    return `${d.toLocaleDateString('de-DE', opts)} um ${d.toLocaleTimeString('de-DE', { ...opts, hour: '2-digit', minute: '2-digit' })} Uhr`
  })

  async function submit() {
    if (submitting.value) return
    if (!form.name.trim() || !form.email.trim() || !form.orderRef.trim()) {
      submitError.value = 'Bitte Name, E-Mail-Adresse und Bestellnummer angeben.'
      return
    }
    if (form.scope === 'partial' && !form.items.trim()) {
      submitError.value = 'Bitte angeben, welche Artikel Sie widerrufen.'
      return
    }
    submitting.value = true
    submitError.value = ''
    try {
      const res = await $fetch<{ ok: boolean; receivedAt: string }>('/api/withdrawal', {
        method: 'POST',
        body: {
          name: form.name,
          email: form.email,
          orderRef: form.orderRef,
          scope: form.scope,
          ...(form.scope === 'partial' && { items: form.items }),
          ...(form.message.trim() && { message: form.message }),
        },
      })
      receivedAt.value = res.receivedAt
    } catch (e: unknown) {
      const obj = e as { data?: { statusMessage?: string }; statusMessage?: string }
      submitError.value =
        obj.data?.statusMessage ||
        obj.statusMessage ||
        'Der Widerruf konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie uns eine E-Mail.'
    } finally {
      submitting.value = false
    }
  }
</script>
