import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The client-side view of who is logged in. It never holds a password or a
 * token — the session lives in an httpOnly cookie — so what is tested here is
 * that the state always follows what the server said, including after a login,
 * a registration or a logout.
 *
 * State is module level, so every test imports the composable fresh.
 */
const ME = {
  authenticated: true,
  customerId: 3,
  email: 'kundin@example.org',
  firstname: 'Erika',
  lastname: 'Musterfrau',
  telephone: '0711',
  address: { street: 'Im Winkel 11', postcode: '88422', city: 'Dürnau', countryId: 81 },
}

const fetchMock = vi.fn()

async function freshAuth() {
  vi.resetModules()
  globalThis.$fetch = fetchMock as unknown as typeof $fetch
  const { useAuth } = await import('./useAuth')
  return useAuth()
}

/** The composable kicks off a refresh on first use; let it settle. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ authenticated: false })
})

describe('initial load', () => {
  it('asks the server who is logged in', async () => {
    const auth = await freshAuth()
    await settle()

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me')
    expect(auth.loaded.value).toBe(true)
  })

  it('adopts the returned customer', async () => {
    fetchMock.mockResolvedValue(ME)

    const auth = await freshAuth()
    await settle()

    expect(auth.user.value).toStrictEqual({
      customerId: 3,
      email: 'kundin@example.org',
      firstname: 'Erika',
      lastname: 'Musterfrau',
      telephone: '0711',
      address: { street: 'Im Winkel 11', postcode: '88422', city: 'Dürnau', countryId: 81 },
    })
  })

  it('stays anonymous when nobody is logged in', async () => {
    const auth = await freshAuth()
    await settle()

    expect(auth.user.value).toBeNull()
  })

  it('fills in gaps in an incomplete answer', async () => {
    fetchMock.mockResolvedValue({ authenticated: true, customerId: 3 })

    const auth = await freshAuth()
    await settle()

    // A missing address must not leave `undefined` in the checkout form.
    expect(auth.user.value).toMatchObject({
      email: '',
      address: { street: '', postcode: '', city: '', countryId: 0 },
    })
  })

  it('does not ask a second time once loaded', async () => {
    const auth = await freshAuth()
    await settle()
    const callsAfterFirst = fetchMock.mock.calls.length

    // A second component using the composable shares the state.
    const { useAuth } = await import('./useAuth')
    useAuth()
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirst)
    expect(auth.loaded.value).toBe(true)
  })

  it('marks itself loaded even when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const auth = await freshAuth()

    await expect(auth.refresh()).rejects.toThrow('offline')
    // Otherwise the UI would sit in a permanent loading state.
    expect(auth.loaded.value).toBe(true)
    expect(auth.loading.value).toBe(false)
  })
})

describe('login', () => {
  it('posts the credentials and reloads the session', async () => {
    const auth = await freshAuth()
    await settle()
    fetchMock.mockResolvedValue(ME)

    await auth.login('kundin@example.org', 'supersecret')

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { email: 'kundin@example.org', password: 'supersecret' },
    })
    expect(auth.user.value?.customerId).toBe(3)
  })

  it('lets a failed login through to the caller', async () => {
    const auth = await freshAuth()
    await settle()
    fetchMock.mockRejectedValue(Object.assign(new Error('401'), { statusCode: 401 }))

    // The form shows the message, so it must not be swallowed here.
    await expect(auth.login('kundin@example.org', 'falsch')).rejects.toThrow('401')
    expect(auth.user.value).toBeNull()
  })
})

describe('register', () => {
  it('posts the registration and reloads the session', async () => {
    const auth = await freshAuth()
    await settle()
    fetchMock.mockResolvedValue(ME)

    const input = {
      gender: 'f' as const,
      firstname: 'Neue',
      lastname: 'Kundin',
      dob: '1990-06-15',
      email: 'neu@example.org',
      telephone: '0711',
      password: 'ein-gutes-passwort',
      street: 'Teststraße 1',
      postcode: '70173',
      city: 'Stuttgart',
      country: 'DE' as const,
    }
    await auth.register(input)

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', { method: 'POST', body: input })
    expect(auth.user.value?.customerId).toBe(3)
  })
})

describe('logout', () => {
  it('drops the customer without waiting for a reload', async () => {
    fetchMock.mockResolvedValue(ME)
    const auth = await freshAuth()
    await settle()
    expect(auth.user.value).not.toBeNull()

    await auth.logout()

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    expect(auth.user.value).toBeNull()
  })
})
