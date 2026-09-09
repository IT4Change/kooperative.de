import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
// readBody is a Nitro auto-import and therefore not in scope on this side of
// the fence; the fake endpoints below run on h3 all the same.
import { readBody } from 'h3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import OrderDetail from './[id].vue'

import { waitFor, waitForText } from '~~/test/helpers/wait'

/**
 * The order detail view is where the operator actually works: set a status,
 * optionally notify the customer, or resend the last notification. Everything
 * else on the page is a rendering of what the API returned — including the
 * osCommerce totals, which arrive as HTML fragments and have to be stripped.
 */
const ID = 4711

let detail: Record<string, unknown> = {}
let detailStatus = 200
let detailMessage: string | undefined = 'Datenbank weg'
let statusResponse: unknown = { notified: false, mail: null }
let statusFails: string | null = null
let statusThrowsBare = false
let notifyResponse: unknown = { ok: true, mail: { status: 'sent' } }
let notifyFails: string | null = null
const statusCalls: unknown[] = []
const notifyCalls: unknown[] = []
let refreshes = 0

function base() {
  return {
    origin: 'neu' as const,
    confirmation: { via: 'link', at: '2026-03-05T12:00:00' },
    oldAdminUrl: null,
    availableStatuses: [
      { id: 1, name: 'In Bearbeitung' },
      { id: 2, name: 'Versandbereit' },
      { id: 3, name: 'Versendet' },
    ],
    statusFlow: [
      { id: 1, name: 'In Bearbeitung', state: 'done', visitedAt: '2026-03-04T10:00:00' },
      { id: 2, name: 'Versandbereit', state: 'current', visitedAt: '2026-03-05T10:00:00' },
      { id: 3, name: 'Versendet', state: 'upcoming', visitedAt: null },
    ],
    mails: [
      {
        id: 1,
        direction: 'to_customer',
        recipient: 'erika@example.org',
        mailType: 'status_notification',
        relatedStatusId: 2,
        subject: 'Ihre Bestellung',
        status: 'sent',
        sentBy: 'admin',
        createdAt: '2026-03-05T10:01:00',
      },
      {
        id: 2,
        direction: 'to_operator',
        recipient: 'buero@example.org',
        mailType: 'irgendwas_neues',
        relatedStatusId: null,
        subject: 'Neue Bestellung',
        status: 'failed',
        sentBy: null,
        createdAt: '2026-03-04T10:01:00',
      },
    ],
    order: {
      id: ID,
      statusId: 2,
      statusName: 'Versandbereit',
      datePurchased: '2026-03-04T10:00:00',
      lastModified: '2026-03-05T10:00:00',
      paymentMethod: 'Rechnung',
      currency: 'EUR',
      customer: {
        id: 88,
        name: 'Erika Muster',
        company: 'Muster GmbH',
        email: 'erika@example.org',
        telephone: '0711 123',
        street: 'Hauptstr. 1',
        suburb: null,
        postcode: '73105',
        city: 'Dürnau',
        country: 'Deutschland',
      },
      delivery: {
        name: 'Erika Muster',
        company: null,
        street: 'Hauptstr. 1',
        suburb: 'Hinterhaus',
        postcode: '73105',
        city: 'Dürnau',
        country: 'Deutschland',
      },
    },
    products: [
      { id: 12, model: 'ART-1', name: 'Honig', price: 10, finalPrice: 11.9, tax: 7, quantity: 2 },
      { id: 13, model: '', name: 'Karte', price: 2, finalPrice: 2.38, tax: 19, quantity: 1 },
    ],
    totals: [
      { title: 'Zwischensumme:', text: '<b>26,18&nbsp;&euro;</b>', value: 26.18, class: 'ot_sub' },
      { title: 'Gesamt:', text: '<b>26,18&nbsp;&amp;euro;</b>', value: 26.18, class: 'ot_total' },
    ],
    history: [
      {
        statusId: 2,
        statusName: 'Versandbereit',
        dateAdded: '2026-03-05T10:00:00',
        customerNotified: true,
        comments: 'Paket gepackt',
      },
      {
        statusId: 1,
        statusName: null,
        dateAdded: '2026-03-04T10:00:00',
        customerNotified: false,
        comments: '',
      },
    ],
  }
}

registerEndpoint(`/admin/api/orders/${ID}`, () => {
  refreshes += 1
  if (detailStatus !== 200) {
    throw createError({ statusCode: detailStatus, statusMessage: detailMessage })
  }
  return detail
})
registerEndpoint(`/admin/api/orders/${ID}/status`, {
  method: 'POST',
  handler: async (event) => {
    statusCalls.push(await readBody(event))
    if (statusFails) throw createError({ statusCode: 400, statusMessage: statusFails })
    if (statusThrowsBare) throw new Error('Verbindung abgebrochen')
    return statusResponse
  },
})
registerEndpoint(`/admin/api/orders/${ID}/notify`, {
  method: 'POST',
  handler: async (event) => {
    notifyCalls.push(await readBody(event))
    if (notifyFails) throw createError({ statusCode: 400, statusMessage: notifyFails })
    return notifyResponse
  },
})

let unmount: (() => void) | null = null

beforeEach(() => {
  detail = base()
  detailStatus = 200
  detailMessage = 'Datenbank weg'
  statusResponse = { notified: false, mail: null }
  statusFails = null
  statusThrowsBare = false
  notifyResponse = { ok: true, mail: { status: 'sent' } }
  notifyFails = null
  statusCalls.length = 0
  notifyCalls.length = 0
  refreshes = 0
  clearNuxtData()
})

afterEach(() => {
  unmount?.()
  unmount = null
})

async function mount() {
  const wrapper = await mountSuspended(OrderDetail, { route: `/admin/orders/${ID}` })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

const button = (w: Awaited<ReturnType<typeof mount>>, label: string) =>
  w.findAll('button').find((b) => b.text().includes(label))!

describe('the header', () => {
  it('names the order and its status', async () => {
    const wrapper = await mount()

    expect(wrapper.get('h2').text()).toBe('Bestellung #4711')
    expect(wrapper.text()).toContain('Versandbereit')
    expect(wrapper.text()).toContain('Neuer Shop')
  })

  it('falls back to the raw status id when the name is missing', async () => {
    detail = { ...base(), order: { ...base().order, statusName: null } }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Status 2')
  })

  it('offers the old admin only when there is a link for it', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Alter Admin')
  })

  it('links to the old admin for an order that came from there', async () => {
    detail = { ...base(), origin: 'alt', oldAdminUrl: 'https://alt.example/admin?oID=4711' }

    const wrapper = await mount()

    expect(wrapper.get('a[href="https://alt.example/admin?oID=4711"]').text()).toContain(
      'Alter Admin',
    )
    expect(wrapper.text()).toContain('Alter Shop')
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

  it('says plainly when the order is simply not there', async () => {
    detailStatus = 404

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Bestellung nicht gefunden.')
  })

  it('shows the payment method as unset when the order carries none', async () => {
    detail = { ...base(), order: { ...base().order, paymentMethod: '' } }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('–')
  })
})

describe('the status stepper', () => {
  it('marks done, current and upcoming differently', async () => {
    const wrapper = await mount()
    const circles = wrapper.findAll('.w-10.h-10')

    expect(circles[0].classes()).toContain('bg-[#00af8c]')
    expect(circles[1].classes()).toContain('ring-4')
    expect(circles[2].classes()).toContain('border-gray-300')
  })

  it('ticks off the steps already passed', async () => {
    const wrapper = await mount()

    expect(wrapper.findAll('.w-10.h-10 svg')).toHaveLength(1)
    // The upcoming step shows its ordinal instead.
    expect(wrapper.findAll('.w-10.h-10')[2].text()).toBe('3')
  })

  it('notes when and how the customer confirmed', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('Vom Kunden bestätigt (per Link)')
  })

  it.each([
    ['admin', 'manuell im Admin'],
    ['reply', 'per Antwort'],
  ])('names confirmation via %s', async (via, label) => {
    detail = { ...base(), confirmation: { via, at: null } }

    const wrapper = await mount()

    expect(wrapper.text()).toContain(label)
  })

  it('says nothing about a confirmation that never happened', async () => {
    // A new-shop order can sit in the list before the customer answered.
    detail = { ...base(), confirmation: null }

    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Vom Kunden bestätigt')
    expect(wrapper.text()).not.toContain('keine gesonderte Bestätigung')
  })

  it('explains that old orders were never confirmed', async () => {
    detail = { ...base(), origin: 'alt' }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('keine gesonderte Bestätigung')
  })
})

describe('positions and totals', () => {
  it('shows every line with its own total', async () => {
    const wrapper = await mount()
    const first = wrapper
      .findAll('tbody tr')[0]
      .findAll('td')
      .map((c) => c.text())

    expect(first[0]).toContain('Honig')
    expect(first[0]).toContain('ART-1')
    expect(first[0]).toContain('MwSt')
    expect(first[1]).toBe('2')
    expect(first[2]).toBe('11,90 €')
    expect(first[3]).toBe('23,80 €')
  })

  it('leaves the model out when the product has none', async () => {
    const wrapper = await mount()
    const second = wrapper.findAll('tbody tr')[1].findAll('td')[0].text()

    expect(second).toContain('Nr. 13')
    expect(second).not.toContain('·  ·')
  })

  it('strips the osCommerce markup out of the totals', async () => {
    const wrapper = await mount()
    const cells = wrapper.findAll('tfoot td').map((c) => c.text())

    // The API hands these over as '<b>26,18&nbsp;&euro;</b>'.
    expect(cells[1]).toBe('26,18 &euro;')
    expect(cells[3]).toBe('26,18 &euro;')
  })

  it('makes the grand total stand out', async () => {
    const wrapper = await mount()

    expect(wrapper.findAll('tfoot td')[2].classes()).toContain('font-bold')
  })
})

describe('history and mails', () => {
  it('lists each status change with its notification state', async () => {
    const wrapper = await mount()
    const entries = wrapper.findAll('li').map((l) => l.text().replace(/\s+/g, ' '))

    expect(entries[0]).toContain('Paket gepackt')
    expect(entries[0]).toContain('✉ benachrichtigt')
    expect(entries[1]).toContain('Status 1')
    expect(entries[1]).toContain('— keine Mail')
  })

  it('says so when there is no history', async () => {
    detail = { ...base(), history: [] }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Kein Verlauf vorhanden.')
  })

  it('translates the mail types it knows', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('Statusmeldung')
    // And leaves an unknown one as it is rather than hiding it.
    expect(wrapper.text()).toContain('irgendwas_neues')
  })

  it('distinguishes sent from failed mails', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('gesendet')
    expect(wrapper.text()).toContain('fehlgeschlagen')
    expect(wrapper.text()).toContain('→ Kunde')
    expect(wrapper.text()).toContain('→ Admin')
  })

  it('says so when no mail has gone out yet', async () => {
    detail = { ...base(), mails: [] }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Noch keine E-Mails zu dieser Bestellung.')
  })
})

describe('setting a status', () => {
  it('starts on the status the order already has', async () => {
    const wrapper = await mount()

    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('2')
  })

  it('sends status, comment and the notify flag', async () => {
    const wrapper = await mount()
    await wrapper.get('select').setValue('3')
    await wrapper.get('textarea').setValue('Paket ist raus')

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitFor(() => statusCalls.length > 0, 'the status POST')

    expect(statusCalls[0]).toStrictEqual({
      statusId: 3,
      comment: 'Paket ist raus',
      notifyCustomer: true,
    })
  })

  it('reports a plain status change', async () => {
    const wrapper = await mount()

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitForText(wrapper, 'Status gesetzt.')

    expect(wrapper.text()).toContain('Status gesetzt.')
  })

  it('says whether the notification actually went out', async () => {
    statusResponse = { notified: true, mail: { status: 'sent' } }
    const wrapper = await mount()

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitForText(wrapper, 'Kunde benachrichtigt')

    expect(wrapper.text()).toContain('Status gesetzt · Kunde benachrichtigt (gesendet)')
  })

  it('does not pretend the mail worked when it did not', async () => {
    statusResponse = { notified: true, mail: { status: 'failed' } }
    const wrapper = await mount()

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitForText(wrapper, 'Mailfehler')

    expect(wrapper.text()).toContain('Mailfehler')
  })

  it('clears the comment and reloads the order', async () => {
    const wrapper = await mount()
    await wrapper.get('textarea').setValue('Notiz')

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitFor(() => refreshes === 2, 'the reload after the status change')

    // Leaving the comment in place would send it a second time by accident.
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(refreshes).toBe(2)
  })

  it('shows the server error and keeps the comment', async () => {
    statusFails = 'Status nicht erlaubt'
    const wrapper = await mount()
    await wrapper.get('textarea').setValue('Notiz')

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitForText(wrapper, 'Fehler: Status nicht erlaubt')

    expect(wrapper.text()).toContain('Fehler: Status nicht erlaubt')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Notiz')
  })

  it('falls back to the transport error when the server names no reason', async () => {
    // An unhandled exception in the handler arrives as a bare 500 — the reason
    // stays on the server, so the operator gets the request line instead.
    statusThrowsBare = true
    const wrapper = await mount()

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitForText(wrapper, 'Fehler:')

    expect(wrapper.text()).toMatch(/Fehler: \[POST\].*500/)
  })

  it('can leave the customer out of it', async () => {
    const wrapper = await mount()
    await wrapper.get('input[type="checkbox"]').setValue(false)

    await button(wrapper, 'Status aktualisieren').trigger('click')
    await waitFor(() => statusCalls.length > 0, 'the status POST')

    expect(statusCalls[0]).toMatchObject({ notifyCustomer: false })
  })
})

describe('resending the notification', () => {
  it('sends the current comment along', async () => {
    const wrapper = await mount()
    await wrapper.get('textarea').setValue('Nachtrag')

    await button(wrapper, 'Benachrichtigung').trigger('click')
    await waitForText(wrapper, 'Benachrichtigung gesendet.')

    expect(notifyCalls[0]).toStrictEqual({ comment: 'Nachtrag' })
    expect(wrapper.text()).toContain('Benachrichtigung gesendet.')
  })

  it('reports a refused mail as a failure', async () => {
    notifyResponse = { ok: false, mail: { status: 'failed' } }
    const wrapper = await mount()

    await button(wrapper, 'Benachrichtigung').trigger('click')
    await waitForText(wrapper, 'Mailversand fehlgeschlagen.')

    expect(wrapper.text()).toContain('Mailversand fehlgeschlagen.')
  })

  it('shows the server error', async () => {
    notifyFails = 'Kein Mailserver'
    const wrapper = await mount()

    await button(wrapper, 'Benachrichtigung').trigger('click')
    await waitForText(wrapper, 'Fehler: Kein Mailserver')

    expect(wrapper.text()).toContain('Fehler: Kein Mailserver')
  })
})

describe('customer and addresses', () => {
  it('shows the customer with a mailto link', async () => {
    const wrapper = await mount()

    expect(wrapper.get('a[href="mailto:erika@example.org"]').text()).toBe('erika@example.org')
    expect(wrapper.text()).toContain('Muster GmbH')
    expect(wrapper.text()).toContain('Kunden-Nr. 88')
  })

  it('shows a delivery company and leaves an absent suburb out', async () => {
    const order = base().order
    detail = {
      ...base(),
      order: {
        ...order,
        customer: { ...order.customer, company: null },
        delivery: { ...order.delivery, company: 'Muster GmbH', suburb: null },
      },
    }

    const wrapper = await mount()
    const text = wrapper.text()

    expect(text).toContain('Muster GmbH')
    expect(text).not.toContain('Hinterhaus')
  })

  it('shows the delivery address including the suburb', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('Hinterhaus')
    expect(wrapper.text()).toContain('73105 Dürnau')
  })

  it('marks a missing telephone number rather than leaving a gap', async () => {
    const order = base().order
    detail = { ...base(), order: { ...order, customer: { ...order.customer, telephone: '' } } }

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Tel.: –')
  })
})
