import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import ConfirmPage from './bestaetigen.vue'

/**
 * The review page behind the link in the confirmation mail. Its button is the
 * step that makes the order binding, so its wording is not a matter of taste:
 * § 312j Abs. 3 BGB requires it to state the obligation to pay — otherwise no
 * contract comes about at all.
 */
const TOKEN = 'a'.repeat(64)

interface View {
  status: string
  orderId: number | null
  shipping: { label: string; price: number }
  taxRows: { description: string; total: number }[]
  notes: string
}

const PENDING: View = {
  status: 'pending',
  orderId: null,
  shipping: { label: 'Abholung', price: 0 },
  taxRows: [],
  notes: '',
}

let view: View = PENDING
let confirmFails: 'no' | 'message' = 'no'
const confirmCalls: unknown[] = []

registerEndpoint(`/api/orders/pending/${TOKEN}`, () => ({
  ...view,
  customer: {
    name: 'Erika Musterfrau',
    email: 'kundin@example.org',
    street: 'Musterweg 1',
    postcode: '12345',
    city: 'Musterstadt',
    country: 'Deutschland',
  },
  items: [{ name: 'Honig', quantity: 2, unitPrice: 5.95, lineTotal: 11.9 }],
  subtotal: 11.9,
  payment: 'Bezahlung mit Vorkasse',
  total: 11.9 + view.shipping.price,
}))
registerEndpoint('/api/orders/pending/unbekannt', () => {
  throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })
})
registerEndpoint('/api/orders/confirm', {
  method: 'POST',
  handler: async (event) => {
    confirmCalls.push(await readBody(event))
    if (confirmFails === 'message') {
      throw createError({ statusCode: 409, statusMessage: 'Bestellung wurde storniert' })
    }
    view = { ...view, status: 'materialized', orderId: 77 }
    return { ok: true, orderId: 77 }
  },
})

beforeEach(() => {
  view = PENDING
  confirmFails = 'no'
  confirmCalls.length = 0
  clearNuxtData()
})

// A page left mounted keeps watching the shared router: the next test's route
// change would make it refetch and write its error into the same data key.
let unmount: (() => void) | null = null

afterEach(() => {
  unmount?.()
  unmount = null
  vi.unstubAllGlobals()
})

async function mount(token: string | null = TOKEN) {
  const wrapper = await mountSuspended(ConfirmPage, {
    route: token === null ? '/bestellung/bestaetigen' : `/bestellung/bestaetigen?token=${token}`,
  })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

describe('order confirmation page', () => {
  it('labels the binding button as the law requires', async () => {
    const wrapper = await mount()

    expect(wrapper.get('button').text()).toBe('Zahlungspflichtig bestellen')
  })

  it('shows what is being ordered before the button', async () => {
    view = {
      ...PENDING,
      shipping: { label: 'Versand mit DHL', price: 12 },
      taxRows: [{ description: 'MwSt. 7 %', total: 0.78 }],
      notes: 'Bitte klingeln',
    }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Honig')
    expect(wrapper.text()).toContain('Versand (Versand mit DHL)')
    expect(wrapper.text()).toContain('12,00 €')
    expect(wrapper.text()).toContain('MwSt. 7 %')
    expect(wrapper.text()).toContain('Bitte klingeln')
    expect(wrapper.text()).toContain('23,90 €')
  })

  it('prices pick-up and other arrangements as "nach Aufwand"', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('nach Aufwand')
    expect(wrapper.text()).not.toContain('Anmerkung')
  })

  it('confirms the order with the token from the link', async () => {
    const wrapper = await mount()

    await wrapper.get('button').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Vielen Dank – Bestellung bestätigt')
    })
    expect(confirmCalls).toStrictEqual([{ token: TOKEN }])
    expect(wrapper.text()).toContain('(Nr. 77)')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('says why a confirmation failed and keeps the button', async () => {
    confirmFails = 'message'
    const wrapper = await mount()

    await wrapper.get('button').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Bestellung wurde storniert')
    })
    expect(wrapper.get('button').text()).toBe('Zahlungspflichtig bestellen')
  })

  it('falls back to the transport message, then to a generic one', async () => {
    const wrapper = await mount()

    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ statusMessage: 'Bad Gateway' }))
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Bad Gateway')
    })

    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({}))
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Bestätigung fehlgeschlagen.')
    })
  })

  it('shows an already confirmed order without a button', async () => {
    view = { ...PENDING, status: 'confirmed', orderId: null }

    const wrapper = await mount()

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bestellung bestätigt')
    expect(wrapper.text()).not.toContain('(Nr.')
  })

  it('shows a cancelled order without a button', async () => {
    view = { ...PENDING, status: 'cancelled' }

    const wrapper = await mount()

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bestellung storniert')
  })

  it('says so when the link does not lead to an order', async () => {
    const wrapper = await mount('unbekannt')

    expect(wrapper.text()).toContain('Diese Bestellung konnte nicht gefunden werden')
  })

  it('asks nothing without a token', async () => {
    const wrapper = await mount(null)

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})
