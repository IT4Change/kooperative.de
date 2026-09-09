import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import PendingDetail from './[id].vue'

import { waitFor, waitForText } from '~~/test/helpers/wait'

/**
 * An order that is waiting for the customer to confirm it. It has no order
 * number yet, so the operator's two levers are "confirm it by hand" (because
 * the customer answered by mail) and "cancel it".
 */
const ID = 12

let detail: Record<string, unknown> = {}
let detailStatus = 200
let detailMessage: string | undefined = 'Datenbank weg'
let confirmFails: string | null = null
let cancelFails: string | null = null
let confirms = 0
let cancels = 0
let loads = 0

function base() {
  return {
    statusFlow: [
      { id: 1, name: 'Eingegangen', state: 'done', visitedAt: '2026-03-04T10:00:00' },
      { id: 2, name: 'Bestätigung', state: 'current', visitedAt: null },
      { id: 3, name: 'Bestellt', state: 'upcoming', visitedAt: null },
    ],
    pending: {
      id: ID,
      status: 'pending',
      ordersId: null,
      confirmedVia: null,
      createdAt: '2026-03-04T10:00:00',
      confirmedAt: null,
      total: 28.56,
    },
    customer: {
      id: 88,
      name: 'Erika Muster',
      company: null,
      email: 'erika@example.org',
      telephone: '0711 123',
      street: 'Hauptstr. 1',
      postcode: '73105',
      city: 'Dürnau',
      country: 'Deutschland',
    },
    items: [
      { name: 'Honig', quantity: 2, unitPrice: 11.9, lineTotal: 23.8 },
      { name: 'Karte', quantity: 1, unitPrice: 2.38, lineTotal: 2.38 },
    ],
    subtotal: 26.18,
    shipping: { label: 'DHL', price: 2.38 },
    taxRows: [{ description: 'zzgl. 7% MwSt.', total: 1.71 }],
    payment: 'Rechnung',
    notes: 'Bitte klingeln',
    total: 28.56,
    mails: [
      {
        id: 1,
        direction: 'to_customer',
        recipient: 'erika@example.org',
        mailType: 'order_confirmation_request',
        subject: 'Bitte bestätigen',
        status: 'sent',
        sentBy: null,
        createdAt: '2026-03-04T10:01:00',
      },
    ],
  }
}

registerEndpoint(`/admin/api/pending/${ID}`, () => {
  loads += 1
  if (detailStatus !== 200) {
    throw createError({ statusCode: detailStatus, statusMessage: detailMessage })
  }
  return detail
})
registerEndpoint(`/admin/api/pending/${ID}/confirm`, {
  method: 'POST',
  handler: () => {
    confirms += 1
    if (confirmFails) throw createError({ statusCode: 400, statusMessage: confirmFails })
    return { ok: true, orderId: 5001 }
  },
})
registerEndpoint(`/admin/api/pending/${ID}/cancel`, {
  method: 'POST',
  handler: () => {
    cancels += 1
    if (cancelFails) throw createError({ statusCode: 400, statusMessage: cancelFails })
    return { ok: true }
  },
})

let unmount: (() => void) | null = null

beforeEach(() => {
  detail = base()
  detailStatus = 200
  detailMessage = 'Datenbank weg'
  confirmFails = null
  cancelFails = null
  confirms = 0
  cancels = 0
  loads = 0
  clearNuxtData()
})

afterEach(() => {
  unmount?.()
  unmount = null
})

async function mount() {
  const wrapper = await mountSuspended(PendingDetail, { route: `/admin/pending/${ID}` })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

const button = (w: Awaited<ReturnType<typeof mount>>, label: string) =>
  w.findAll('button').find((b) => b.text().includes(label))!

describe('the header', () => {
  it('says that there is no order number yet', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('noch keine Bestell-Nr.')
    expect(wrapper.text()).toContain('Bestätigung ausstehend')
    expect(wrapper.text()).toContain('Neuer Shop')
  })

  it.each([
    ['pending', 'Bestätigung ausstehend', 'bg-amber-100'],
    ['materialized', 'Bestätigt', 'bg-green-100'],
    ['cancelled', 'Storniert', 'bg-gray-200'],
  ])('labels the %s state', async (status, label, badge) => {
    detail = { ...base(), pending: { ...base().pending, status } }

    const wrapper = await mount()
    const chip = wrapper.findAll('span').find((s) => s.text() === label)

    expect(chip).toBeDefined()
    expect(chip!.classes()).toContain(badge)
  })

  it('reports a load failure', async () => {
    detailStatus = 500

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Datenbank weg')
  })

  it('shows the transport error when the server names no reason', async () => {
    detailStatus = 503
    detailMessage = undefined

    const wrapper = await mount()

    expect(wrapper.text()).toMatch(/\[GET\].*503/)
  })

  it('says plainly when the process is not there', async () => {
    detailStatus = 404

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Vorgang nicht gefunden.')
  })
})

describe('the stepper', () => {
  it('explains what is being waited for', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('wartet auf die Bestätigung des Kunden')
  })

  it('disappears once the order was cancelled', async () => {
    // There is no process left to illustrate.
    detail = { ...base(), pending: { ...base().pending, status: 'cancelled' } }

    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Bestellprozess')
  })

  it('marks done, current and upcoming differently', async () => {
    const wrapper = await mount()
    const circles = wrapper.findAll('.w-10.h-10')

    expect(circles[0].findAll('svg')).toHaveLength(1)
    expect(circles[1].classes()).toContain('ring-4')
    expect(circles[2].classes()).toContain('border-gray-300')
  })
})

describe('positions and totals', () => {
  it('shows every line', async () => {
    const wrapper = await mount()
    const cells = wrapper
      .findAll('tbody tr')[0]
      .findAll('td')
      .map((c) => c.text())

    expect(cells).toStrictEqual(['Honig', '2', '11,90 €', '23,80 €'])
  })

  it('shows subtotal, shipping, tax and total', async () => {
    const wrapper = await mount()
    const foot = wrapper.get('tfoot').text().replace(/\s+/g, ' ')

    expect(foot).toContain('Zwischensumme26,18 €')
    expect(foot).toContain('Versand (DHL) 2,38 €')
    expect(foot).toContain('zzgl. 7% MwSt.1,71 €')
    expect(foot).toContain('Gesamt28,56 €')
  })

  it('says "nach Aufwand" when the shipping cost is not known yet', async () => {
    // A zero here means "we will work it out", not "free".
    detail = { ...base(), shipping: { label: 'Selbstabholung', price: 0 } }

    const wrapper = await mount()

    expect(wrapper.get('tfoot').text()).toContain('nach Aufwand')
  })
})

describe('mails', () => {
  it('lists what has gone out', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('Bitte bestätigen')
    expect(wrapper.text()).toContain('→ Kunde')
    expect(wrapper.text()).toContain('gesendet')
  })

  it('distinguishes the operator mails from the customer ones', async () => {
    detail = {
      ...base(),
      mails: [
        ...base().mails,
        {
          id: 2,
          direction: 'to_admin',
          recipient: 'buero@example.org',
          mailType: 'admin_new_pending',
          subject: 'Neue Bestellung',
          status: 'failed',
          sentBy: 'system',
          createdAt: '2026-03-04T10:02:00',
        },
      ],
    }

    const wrapper = await mount()
    const text = wrapper.text()

    expect(text).toContain('→ Kunde')
    expect(text).toContain('→ Admin')
    expect(text).toContain('gesendet')
    expect(text).toContain('fehlgeschlagen')
    // sentBy is optional; the second row has one, the first does not.
    expect(text).toContain('· system')
  })

  it('says so when there are none', async () => {
    detail = { ...base(), mails: [] }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Keine E-Mails.')
  })
})

describe('confirming by hand', () => {
  it('creates the order and names its number', async () => {
    const wrapper = await mount()

    await button(wrapper, 'Manuell bestätigen').trigger('click')
    await waitFor(() => loads === 2, 'the reload after confirming')

    expect(confirms).toBe(1)
    expect(wrapper.text()).toContain('Bestätigt – Bestellung #5001 angelegt.')
    // The panel has to show the new state, not the one from before the click.
    expect(loads).toBe(2)
  })

  it('shows what went wrong', async () => {
    confirmFails = 'Schon bestätigt'
    const wrapper = await mount()

    await button(wrapper, 'Manuell bestätigen').trigger('click')
    await waitForText(wrapper, 'Fehler: Schon bestätigt')

    expect(wrapper.text()).toContain('Fehler: Schon bestätigt')
  })

  it('cancels the process', async () => {
    const wrapper = await mount()

    await button(wrapper, 'Stornieren').trigger('click')
    await waitForText(wrapper, 'Storniert.')

    expect(cancels).toBe(1)
    expect(wrapper.text()).toContain('Storniert.')
  })

  it('shows what went wrong when cancelling', async () => {
    cancelFails = 'Bereits materialisiert'
    const wrapper = await mount()

    await button(wrapper, 'Stornieren').trigger('click')
    await waitForText(wrapper, 'Fehler: Bereits materialisiert')

    expect(wrapper.text()).toContain('Fehler: Bereits materialisiert')
  })

  it('offers no buttons once the process is settled', async () => {
    detail = {
      ...base(),
      pending: { ...base().pending, status: 'materialized', ordersId: 5001, confirmedVia: 'reply' },
    }

    const wrapper = await mount()

    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})

describe('a confirmed process', () => {
  it('links to the order that came out of it', async () => {
    detail = {
      ...base(),
      pending: { ...base().pending, status: 'materialized', ordersId: 5001, confirmedVia: 'admin' },
    }

    const wrapper = await mount()

    expect(wrapper.get('a[href="/admin/orders/5001"]').text()).toContain('Zur Bestellung #5001')
    expect(wrapper.text()).toContain('manuell im Admin')
  })

  it.each([
    ['reply', 'per Antwort'],
    ['link', 'per Link'],
  ])('names confirmation via %s', async (via, label) => {
    detail = {
      ...base(),
      pending: { ...base().pending, status: 'materialized', ordersId: 5001, confirmedVia: via },
    }

    const wrapper = await mount()

    expect(wrapper.text()).toContain(label)
  })
})

describe('customer and payment', () => {
  it('shows the customer with a mailto link', async () => {
    const wrapper = await mount()

    expect(wrapper.get('a[href="mailto:erika@example.org"]').text()).toBe('erika@example.org')
    expect(wrapper.text()).toContain('Kunden-Nr. 88')
  })

  it('shows the payment method and the customer note', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('Rechnung')
    expect(wrapper.text()).toContain('Anmerkung')
    expect(wrapper.text()).toContain('Bitte klingeln')
  })

  it('leaves the note section out when there is none', async () => {
    detail = { ...base(), notes: '' }

    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Anmerkung')
  })

  it('marks a missing telephone number', async () => {
    detail = { ...base(), customer: { ...base().customer, telephone: '' } }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Tel.: –')
  })

  it('shows the company when there is one', async () => {
    detail = { ...base(), customer: { ...base().customer, company: 'Muster GmbH' } }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Muster GmbH')
  })
})
