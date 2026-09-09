import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import CheckoutLogin from './CheckoutLogin.vue'

/**
 * Sign in or open an account, inside the checkout. It talks to useAuth, so the
 * assertions are about what reaches the API and what the customer is told when
 * it comes back rejected.
 */
const fetchMock = vi.fn()

const REGISTRATION = {
  gender: 'f',
  firstname: 'Neue',
  lastname: 'Kundin',
  dob: '1990-06-15',
  telephone: '0711 999',
  street: 'Teststraße 1',
  postcode: '70173',
  city: 'Stuttgart',
  email: 'neu@example.org',
  password: 'ein-gutes-passwort',
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ authenticated: false })
  globalThis.$fetch = fetchMock as unknown as typeof $fetch
})

/** Fills the registration form, which has eleven fields. */
async function fillRegistration(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  await wrapper.get('select[required]').setValue(REGISTRATION.gender)
  const byLabel = (label: string) => {
    const lbl = wrapper.findAll('label').find((l) => l.text().startsWith(label))
    return wrapper.get(`#${lbl!.attributes('for')}`)
  }
  await byLabel('Vorname').setValue(REGISTRATION.firstname)
  await byLabel('Nachname').setValue(REGISTRATION.lastname)
  await byLabel('Geburtsdatum').setValue(REGISTRATION.dob)
  await byLabel('Telefon').setValue(REGISTRATION.telephone)
  await byLabel('Straße').setValue(REGISTRATION.street)
  await byLabel('PLZ').setValue(REGISTRATION.postcode)
  await byLabel('Ort').setValue(REGISTRATION.city)
  await byLabel('E-Mail').setValue(REGISTRATION.email)
  await byLabel('Passwort').setValue(REGISTRATION.password)
}

describe('switching modes', () => {
  it('starts on the login form', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)

    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Anmelden')
    expect(wrapper.findAll('input')).toHaveLength(2)
  })

  it('switches to the registration form', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)

    await wrapper.findAll('[role="tab"]')[1].trigger('click')

    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Konto anlegen')
    // Eleven fields plus the two selects for salutation and country.
    expect(wrapper.findAll('input').length).toBeGreaterThan(2)
  })

  it('exposes the two forms as tab panels', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)

    expect(wrapper.get('form').attributes('role')).toBe('tabpanel')
  })
})

describe('logging in', () => {
  it('posts the credentials', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)
    await wrapper.get('input[type="email"]').setValue('kundin@example.org')
    await wrapper.get('input[type="password"]').setValue('supersecret')

    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { email: 'kundin@example.org', password: 'supersecret' },
    })
  })

  it('reports success to the parent', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)
    await wrapper.get('input[type="email"]').setValue('kundin@example.org')
    await wrapper.get('input[type="password"]').setValue('supersecret')

    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('shows the server message when the login is refused', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)
    fetchMock.mockRejectedValue({ data: { statusMessage: 'E-Mail oder Passwort falsch' } })
    await wrapper.get('input[type="email"]').setValue('kundin@example.org')
    await wrapper.get('input[type="password"]').setValue('falsch')

    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe('E-Mail oder Passwort falsch')
    expect(wrapper.emitted('success')).toBeUndefined()
  })

  it('falls back to a generic message', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)
    fetchMock.mockRejectedValue({})
    await wrapper.get('input[type="email"]').setValue('a@b.c')
    await wrapper.get('input[type="password"]').setValue('x')

    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe('Fehler')
  })

  it('emits back', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Zurück')!
      .trigger('click')

    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})

describe('registering', () => {
  it('posts the whole registration', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await fillRegistration(wrapper)

    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: expect.objectContaining({ ...REGISTRATION, country: 'DE' }),
    })
  })

  it('insists on a salutation before sending anything', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)
    await wrapper.findAll('[role="tab"]')[1].trigger('click')

    await wrapper.get('form').trigger('submit')
    await wrapper.vm.$nextTick()

    // The server would reject it anyway; saying so here saves a round trip.
    expect(wrapper.get('[role="alert"]').text()).toBe('Bitte Anrede wählen')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/register', expect.anything())
  })

  it('shows the server message when the address is taken', async () => {
    const wrapper = await mountSuspended(CheckoutLogin)
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await fillRegistration(wrapper)
    fetchMock.mockRejectedValue({ statusMessage: 'E-Mail-Adresse bereits registriert' })

    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe('E-Mail-Adresse bereits registriert')
  })
})
