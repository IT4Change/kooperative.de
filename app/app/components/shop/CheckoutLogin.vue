<template>
  <div>
    <!-- Two panels behind two switches — that is a tablist. Saying so also keeps
         the tab "Anmelden" distinguishable from the submit button of the same name. -->
    <div class="flex border-b border-gray-200 mb-4" role="tablist">
      <button
        :id="`${uid}-tab-login`"
        type="button"
        role="tab"
        :aria-selected="mode === 'login'"
        :aria-controls="`${uid}-panel-login`"
        :class="[
          'flex-1 py-2 text-sm font-medium transition-colors',
          mode === 'login' ? 'text-[#00af8c] border-b-2 border-[#00af8c]' : 'text-gray-500',
        ]"
        @click="mode = 'login'"
      >
        Anmelden
      </button>
      <button
        :id="`${uid}-tab-register`"
        type="button"
        role="tab"
        :aria-selected="mode === 'register'"
        :aria-controls="`${uid}-panel-register`"
        :class="[
          'flex-1 py-2 text-sm font-medium transition-colors',
          mode === 'register' ? 'text-[#00af8c] border-b-2 border-[#00af8c]' : 'text-gray-500',
        ]"
        @click="mode = 'register'"
      >
        Konto anlegen
      </button>
    </div>

    <p
      v-if="error"
      role="alert"
      class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
    >
      {{ error }}
    </p>

    <!-- Login -->
    <form
      v-if="mode === 'login'"
      :id="`${uid}-panel-login`"
      role="tabpanel"
      :aria-labelledby="`${uid}-tab-login`"
      class="space-y-3"
      @submit.prevent="onLogin"
    >
      <div>
        <label :for="`${uid}-login-email`" class="block text-sm font-medium text-gray-700 mb-1">
          E-Mail *
        </label>
        <input
          :id="`${uid}-login-email`"
          v-model="loginEmail"
          type="email"
          required
          autocomplete="email"
          :class="inputCls"
        />
      </div>
      <div>
        <label :for="`${uid}-login-password`" class="block text-sm font-medium text-gray-700 mb-1">
          Passwort *
        </label>
        <input
          :id="`${uid}-login-password`"
          v-model="loginPassword"
          type="password"
          required
          autocomplete="current-password"
          :class="inputCls"
        />
        <p class="mt-1 text-xs text-gray-500">
          <a :href="forgotUrl" target="_blank" rel="noopener" class="text-[#00af8c] underline"
            >Passwort vergessen?</a
          >
        </p>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" :class="cancelCls" @click="$emit('back')">Zurück</button>
        <KoopButton type="submit" size="sm" :disabled="busy">{{
          busy ? '…' : 'Anmelden'
        }}</KoopButton>
      </div>
    </form>

    <!-- Register -->
    <form
      v-else
      :id="`${uid}-panel-register`"
      role="tabpanel"
      :aria-labelledby="`${uid}-tab-register`"
      class="space-y-3"
      @submit.prevent="onRegister"
    >
      <div>
        <label :for="`${uid}-gender`" class="block text-sm font-medium text-gray-700 mb-1">
          Anrede *
        </label>
        <select :id="`${uid}-gender`" v-model="reg.gender" required :class="inputCls">
          <option value="">Bitte wählen</option>
          <option value="f">Frau</option>
          <option value="m">Herr</option>
          <option value="d">Divers</option>
        </select>
      </div>
      <div class="flex gap-3">
        <div class="flex-1">
          <label :for="`${uid}-firstname`" class="block text-sm font-medium text-gray-700 mb-1">
            Vorname *
          </label>
          <input
            :id="`${uid}-firstname`"
            v-model="reg.firstname"
            required
            maxlength="32"
            autocomplete="given-name"
            :class="inputCls"
          />
        </div>
        <div class="flex-1">
          <label :for="`${uid}-lastname`" class="block text-sm font-medium text-gray-700 mb-1">
            Nachname *
          </label>
          <input
            :id="`${uid}-lastname`"
            v-model="reg.lastname"
            required
            maxlength="32"
            autocomplete="family-name"
            :class="inputCls"
          />
        </div>
      </div>
      <div>
        <label :for="`${uid}-dob`" class="block text-sm font-medium text-gray-700 mb-1">
          Geburtsdatum *
        </label>
        <input
          :id="`${uid}-dob`"
          v-model="reg.dob"
          type="date"
          required
          autocomplete="bday"
          :class="inputCls"
        />
      </div>
      <div>
        <label :for="`${uid}-telephone`" class="block text-sm font-medium text-gray-700 mb-1">
          Telefon *
        </label>
        <input
          :id="`${uid}-telephone`"
          v-model="reg.telephone"
          type="tel"
          required
          maxlength="32"
          autocomplete="tel"
          :class="inputCls"
        />
      </div>
      <div>
        <label :for="`${uid}-street`" class="block text-sm font-medium text-gray-700 mb-1">
          Straße *
        </label>
        <input
          :id="`${uid}-street`"
          v-model="reg.street"
          required
          maxlength="64"
          autocomplete="street-address"
          :class="inputCls"
        />
      </div>
      <div class="flex gap-3">
        <div class="w-1/3">
          <label :for="`${uid}-postcode`" class="block text-sm font-medium text-gray-700 mb-1">
            PLZ *
          </label>
          <input
            :id="`${uid}-postcode`"
            v-model="reg.postcode"
            required
            maxlength="10"
            autocomplete="postal-code"
            :class="inputCls"
          />
        </div>
        <div class="flex-1">
          <label :for="`${uid}-city`" class="block text-sm font-medium text-gray-700 mb-1">
            Ort *
          </label>
          <input
            :id="`${uid}-city`"
            v-model="reg.city"
            required
            maxlength="32"
            autocomplete="address-level2"
            :class="inputCls"
          />
        </div>
      </div>
      <div>
        <label :for="`${uid}-country`" class="block text-sm font-medium text-gray-700 mb-1">
          Land *
        </label>
        <select :id="`${uid}-country`" v-model="reg.country" required :class="inputCls">
          <option value="DE">Deutschland</option>
          <option value="AT">Österreich</option>
          <option value="CH">Schweiz</option>
        </select>
      </div>
      <div>
        <label :for="`${uid}-email`" class="block text-sm font-medium text-gray-700 mb-1">
          E-Mail *
        </label>
        <input
          :id="`${uid}-email`"
          v-model="reg.email"
          type="email"
          required
          maxlength="96"
          autocomplete="email"
          :class="inputCls"
        />
      </div>
      <div>
        <label :for="`${uid}-password`" class="block text-sm font-medium text-gray-700 mb-1">
          Passwort *
        </label>
        <input
          :id="`${uid}-password`"
          v-model="reg.password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          :aria-describedby="`${uid}-password-hint`"
          :class="inputCls"
        />
        <p :id="`${uid}-password-hint`" class="mt-1 text-xs text-gray-500">Mindestens 8 Zeichen.</p>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" :class="cancelCls" @click="$emit('back')">Zurück</button>
        <KoopButton type="submit" size="sm" :disabled="busy">{{
          busy ? '…' : 'Konto anlegen'
        }}</KoopButton>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  const emit = defineEmits<{ back: []; success: [] }>()

  // SSR-safe and unique per instance — the checkout can be mounted more than once.
  const uid = useId()

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00af8c]'
  const cancelCls =
    'flex-1 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors'

  const mode = ref<'login' | 'register'>('login')
  const busy = ref(false)
  const error = ref('')

  const forgotUrl = 'https://shop.kooperative.de/password_forgotten.php'

  const loginEmail = ref('')
  const loginPassword = ref('')

  const reg = reactive({
    gender: '',
    firstname: '',
    lastname: '',
    dob: '',
    telephone: '',
    street: '',
    postcode: '',
    city: '',
    country: 'DE',
    email: '',
    password: '',
  })

  const { login, register } = useAuth()

  async function onLogin() {
    error.value = ''
    busy.value = true
    try {
      await login(loginEmail.value, loginPassword.value)
      emit('success')
    } catch (e: unknown) {
      error.value = extractError(e)
    } finally {
      busy.value = false
    }
  }

  async function onRegister() {
    error.value = ''
    if (!reg.gender) {
      error.value = 'Bitte Anrede wählen'
      return
    }
    busy.value = true
    try {
      await register({ ...reg, gender: reg.gender })
      emit('success')
    } catch (e: unknown) {
      error.value = extractError(e)
    } finally {
      busy.value = false
    }
  }

  function extractError(e: unknown): string {
    if (typeof e === 'object' && e !== null) {
      const obj = e as {
        statusMessage?: string
        data?: { statusMessage?: string; message?: string }
        message?: string
      }
      return (
        obj.data?.statusMessage || obj.statusMessage || obj.data?.message || obj.message || 'Fehler'
      )
    }
    return 'Fehler'
  }
</script>
