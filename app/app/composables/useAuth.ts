export interface CurrentUser {
  customerId: number
  email: string
  firstname: string
  lastname: string
  telephone: string
  address: { street: string, postcode: string, city: string, countryId: number }
}

const user = ref<CurrentUser | null>(null)
const loaded = ref(false)
const loading = ref(false)

async function refresh() {
  loading.value = true
  try {
    const res = await $fetch<{ authenticated: boolean } & Partial<CurrentUser>>('/api/auth/me')
    if (res.authenticated && res.customerId) {
      user.value = {
        customerId: res.customerId,
        email: res.email ?? '',
        firstname: res.firstname ?? '',
        lastname: res.lastname ?? '',
        telephone: res.telephone ?? '',
        address: res.address ?? { street: '', postcode: '', city: '', countryId: 0 },
      }
    } else {
      user.value = null
    }
  } finally {
    loaded.value = true
    loading.value = false
  }
}

async function login(email: string, password: string) {
  await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
  await refresh()
}

async function register(input: {
  gender: 'm' | 'f' | 'd'
  firstname: string
  lastname: string
  dob: string
  email: string
  telephone: string
  password: string
  street: string
  postcode: string
  city: string
  country: 'DE' | 'AT' | 'CH'
}) {
  await $fetch('/api/auth/register', { method: 'POST', body: input })
  await refresh()
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
}

export function useAuth() {
  if (import.meta.client && !loaded.value && !loading.value) {
    refresh()
  }
  return {
    user: readonly(user),
    loaded: readonly(loaded),
    loading: readonly(loading),
    refresh,
    login,
    register,
    logout,
  }
}
