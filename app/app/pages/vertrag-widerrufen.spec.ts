import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import WithdrawalPage from './vertrag-widerrufen.vue'

/**
 * The withdrawal function (§ 356a BGB). The law fixes the labels ("Vertrag
 * widerrufen" leads here, "Widerruf bestätigen" sends) and forbids hurdles:
 * no login, no reason. After sending, the page has to say when the
 * declaration arrived.
 */
const realFetch = globalThis.$fetch
let calls: Record<string, unknown>[] = []
let failWith: string | null = null

registerEndpoint('/api/withdrawal', {
  method: 'POST',
  handler: async (event) => {
    calls.push(await readBody(event))
    if (failWith !== null)
      throw createError({ statusCode: 429, statusMessage: failWith || undefined })
    return { ok: true, receivedAt: '2026-11-17T13:03:00.000Z' }
  },
})

beforeEach(async () => {
  calls = []
  failWith = null
  const { useAuth } = await import('../composables/useAuth')
  globalThis.$fetch = vi
    .fn()
    .mockResolvedValue({ authenticated: false }) as unknown as typeof $fetch
  await useAuth().refresh()
  globalThis.$fetch = realFetch
})

const mount = async (route = '/vertrag-widerrufen') => mountSuspended(WithdrawalPage, { route })

async function fill(wrapper: Awaited<ReturnType<typeof mount>>, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    const id = wrapper
      .findAll('label')
      .find((l) => l.text().startsWith(label))!
      .attributes('for')
    await wrapper.get(`#${CSS.escape(id!)}`).setValue(value)
  }
}

/** Submits and waits until the page shows the outcome, success or error. */
const send = async (wrapper: Awaited<ReturnType<typeof mount>>) => {
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => {
    expect(wrapper.find('[data-testid="withdrawal-received"], [role="alert"]').exists()).toBe(true)
  })
}

describe('the form', () => {
  it('is headed "Vertrag widerrufen" and sent with "Widerruf bestätigen"', async () => {
    const wrapper = await mount()

    expect(wrapper.get('h1').text()).toBe('Vertrag widerrufen')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Widerruf bestätigen')
  })

  it('takes the order number from the link in the receipt mail', async () => {
    const wrapper = await mount('/vertrag-widerrufen?bestellung=55')
    const order = wrapper.findAll('input[type="text"]')[1]

    expect((order.element as HTMLInputElement).value).toBe('55')
  })

  it('ignores a prefill that is not an order number', async () => {
    const wrapper = await mount('/vertrag-widerrufen?bestellung=<script>')
    const order = wrapper.findAll('input[type="text"]')[1]

    expect((order.element as HTMLInputElement).value).toBe('')
  })

  it('asks which items only for a partial withdrawal', async () => {
    const wrapper = await mount()
    expect(wrapper.text()).not.toContain('Welche Artikel?')

    await wrapper.get('input[value="partial"]').setValue(true)

    expect(wrapper.text()).toContain('Welche Artikel?')

    await wrapper.get('input[value="all"]').setValue(true)

    expect(wrapper.text()).not.toContain('Welche Artikel?')
  })
})

describe('sending', () => {
  it('sends the declaration and says when it arrived', async () => {
    const wrapper = await mount()
    await fill(wrapper, {
      Name: 'Erika Musterfrau',
      'E-Mail': 'kundin@example.org',
      Bestellnummer: '55',
    })

    await send(wrapper)

    expect(calls).toStrictEqual([
      { name: 'Erika Musterfrau', email: 'kundin@example.org', orderRef: '55', scope: 'all' },
    ])
    expect(wrapper.get('h1').text()).toBe('Widerruf eingegangen')
    expect(wrapper.get('[data-testid="withdrawal-received"]').text()).toBe(
      'Ihr Widerruf ist am 17.11.2026 um 14:03 Uhr bei uns eingegangen.',
    )
    expect(wrapper.text()).toContain('kundin@example.org')
  })

  it('carries items and message along when given', async () => {
    const wrapper = await mount()
    await fill(wrapper, { Name: 'E', 'E-Mail': 'k@example.org', Bestellnummer: '55' })
    await wrapper.get('input[value="partial"]').setValue(true)
    await fill(wrapper, { 'Welche Artikel?': '1× Honig', Nachricht: 'Glas kaputt' })

    await send(wrapper)

    expect(calls[0]).toMatchObject({ scope: 'partial', items: '1× Honig', message: 'Glas kaputt' })
  })

  it('sends a double click only once', async () => {
    const wrapper = await mount()
    await fill(wrapper, { Name: 'E', 'E-Mail': 'k@example.org', Bestellnummer: '55' })

    await Promise.all([
      wrapper.get('form').trigger('submit'),
      wrapper.get('form').trigger('submit'),
    ])
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="withdrawal-received"]').exists()).toBe(true)
    })

    expect(calls).toHaveLength(1)
  })

  it('names the missing fields instead of sending', async () => {
    const wrapper = await mount()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toContain('Name, E-Mail-Adresse und Bestellnummer')
    expect(calls).toHaveLength(0)
  })

  it('wants the items of a partial withdrawal', async () => {
    const wrapper = await mount()
    await fill(wrapper, { Name: 'E', 'E-Mail': 'k@example.org', Bestellnummer: '55' })
    await wrapper.get('input[value="partial"]').setValue(true)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toContain('welche Artikel')
    expect(calls).toHaveLength(0)
  })

  it('shows the server message when the declaration is refused', async () => {
    failWith = 'Zu viele Anfragen'
    const wrapper = await mount()
    await fill(wrapper, { Name: 'E', 'E-Mail': 'k@example.org', Bestellnummer: '55' })

    await send(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toBe('Zu viele Anfragen')
  })

  it('offers the mail route when the server gives no reason', async () => {
    failWith = ''
    const wrapper = await mount()
    await fill(wrapper, { Name: 'E', 'E-Mail': 'k@example.org', Bestellnummer: '55' })

    await send(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toContain('schreiben Sie uns eine E-Mail')
  })
})

describe('a signed-in customer', () => {
  it('finds name and address filled in', async () => {
    const { useAuth } = await import('../composables/useAuth')
    globalThis.$fetch = vi.fn().mockResolvedValue({
      authenticated: true,
      customerId: 3,
      email: 'kundin@example.org',
      firstname: 'Erika',
      lastname: 'Musterfrau',
      telephone: '',
      address: { street: '', postcode: '', city: '', countryId: 81 },
    }) as unknown as typeof $fetch
    await useAuth().refresh()
    globalThis.$fetch = realFetch

    const wrapper = await mount()
    const [name, order] = wrapper.findAll('input[type="text"]')

    expect((name.element as HTMLInputElement).value).toBe('Erika Musterfrau')
    expect((wrapper.get('input[type="email"]').element as HTMLInputElement).value).toBe(
      'kundin@example.org',
    )
    expect((order.element as HTMLInputElement).value).toBe('')
  })
})
