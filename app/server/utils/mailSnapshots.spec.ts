// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { buildOrderMail } from './orderMail'
import {
  buildCustomerConfirmRequest,
  buildAdminNewPending,
  buildCustomerConfirmed,
  buildAdminConfirmed,
} from './pendingMail'
import { buildStatusMail } from './statusMail'

import type { OrderComputation } from './orderCompute'
import type { OrderMailContext } from './orderMail'

/**
 * Whole-mail snapshots for every outgoing template.
 *
 * The sibling specs (orderMail, pendingMail, statusMail, mailFooter) assert
 * behaviour: this link must be there, that name must be escaped. They say
 * nothing about everything nobody thought to assert — a shifted amount, a
 * dropped footer line, a table column that lost its header. These mails are the
 * only document the customer receives about a contract they just entered, so
 * that silent surface is worth pinning whole.
 *
 * Snapshots land in `__mail__/` as real files: the `.html` opens in a browser,
 * so the snapshot doubles as the design preview, and a diff in review reads as
 * plain HTML instead of an escaped blob. The `.txt` is the mail as a plain-text
 * mail — the subject (and Reply-To, where the template sets one) as header
 * lines, then the body, because the subject changes more often than anything
 * else and belongs in the same artefact.
 *
 * Nothing here is time- or locale-dependent: every template is a pure function
 * of its context, ids included. Refresh after an intended change with
 * `npm run test:unit -- -u` and read the diff.
 */

/** Three lines on purpose: full VAT, reduced VAT, and a size variant. */
const COMP: OrderComputation = {
  customer: {
    customerId: 3,
    firstname: 'Erika',
    lastname: 'Musterfrau',
    name: 'Erika Musterfrau',
    company: 'Musterfrau & Söhne',
    street: 'Im Winkel 11',
    suburb: null,
    city: 'Dürnau',
    postcode: '88422',
    state: null,
    country: 'Deutschland',
    telephone: '07164 123456',
    email: 'kundin@example.org',
  },
  lines: [
    {
      productId: 1,
      model: 'HON-1',
      name: 'Honig',
      priceNet: 10,
      unitGross: 11.9,
      tax: 19,
      quantity: 2,
      lineGross: 23.8,
    },
    {
      productId: 2,
      model: 'BRO-1',
      name: 'Brot',
      priceNet: 3,
      unitGross: 3.21,
      tax: 7,
      quantity: 3,
      lineGross: 9.63,
    },
    {
      productId: 3,
      model: 'OEL-05',
      name: 'Olivenöl (0,5 l)',
      priceNet: 12,
      unitGross: 14.28,
      tax: 19,
      quantity: 1,
      lineGross: 14.28,
      variantIndex: 1,
    },
  ],
  subtotalGross: 47.71,
  taxRows: [
    { description: 'Mehrwertsteuer', rate: 19, total: 6.08, sortOrder: 0 },
    { description: 'Mehrwertsteuer', rate: 7, total: 0.63, sortOrder: 1 },
  ],
  shipping: { module: 'Versand mit DPD', totalTitle: 'Versand mit DPD:', gross: 7.5 },
  payment: { label: 'Bezahlung mit Vorkasse', method: 'vorkasse' },
  bankDetails: { accountHolder: 'Erika Musterfrau', iban: 'DE02120300000000202051' },
  notes: 'Bitte klingeln,\nwir sind nachmittags da.',
  total: 55.21,
}

/** Collection: a zero shipping cost means "we will work it out", not "free". */
const COMP_PICKUP: OrderComputation = {
  ...COMP,
  customer: { ...COMP.customer, name: '' },
  shipping: { module: 'Abholung', totalTitle: 'Abholung:', gross: 0 },
  total: 47.71,
}

const CTX: OrderMailContext = {
  orderId: 55,
  customer: {
    customerId: 3,
    firstname: 'Erika',
    lastname: 'Musterfrau',
    email: 'kundin@example.org',
    telephone: '07164 123456',
  },
  shipping: {
    street: 'Im Winkel 11',
    postcode: '88422',
    city: 'Dürnau',
    country: 'Deutschland',
  },
  items: [
    { productId: '1', name: 'Honig', quantity: 2, unitPrice: 11.9, lineTotal: 23.8 },
    {
      productId: '3',
      name: 'Olivenöl',
      variantSize: '0,5 l',
      quantity: 1,
      unitPrice: 14.28,
      lineTotal: 14.28,
    },
  ],
  total: 45.58,
  shippingMethod: 'Versand mit DPD',
  shippingPrice: 7.5,
  paymentMethod: 'Bezahlung mit Lastschrift',
  bankDetails: { accountHolder: 'Erika Musterfrau', iban: 'DE02120300000000202051' },
  notes: 'Bitte klingeln,\nwir sind nachmittags da.',
  adminBaseUrl: 'https://shop.example.org/admin/',
}

/** Everything optional left out, and no fixed shipping price. */
const CTX_BARE: OrderMailContext = {
  orderId: 56,
  customer: {
    customerId: 4,
    firstname: 'Max',
    lastname: 'Mustermann',
    email: 'kunde@example.org',
    telephone: '',
  },
  shipping: { street: 'Hauptstr. 1', postcode: '73072', city: 'Donzdorf', country: 'Deutschland' },
  items: [{ productId: '2', name: 'Brot', quantity: 3, unitPrice: 3.21, lineTotal: 9.63 }],
  total: 9.63,
  shippingMethod: 'Abholung',
  shippingPrice: 0,
  paymentMethod: 'Bezahlung mit Vorkasse',
}

const REVIEW_URL = 'https://shop.example.org/bestellung/bestaetigen?token=abc123'
const ADMIN_URL = 'https://shop.example.org/admin/orders/55'

interface BuiltMail {
  subject: string
  text: string
  html: string
  replyTo?: string
}

/** The mail as a plain-text mail: the headers a recipient sees, then the body. */
function asPlainMail(mail: BuiltMail): string {
  return [
    `Subject: ${mail.subject}`,
    ...(mail.replyTo ? [`Reply-To: ${mail.replyTo}`] : []),
    '',
    mail.text,
    '',
  ].join('\n')
}

const CASES: [name: string, mail: BuiltMail][] = [
  // Operator mail of the direct order path.
  ['order-admin-full', buildOrderMail(CTX)],
  ['order-admin-bare', buildOrderMail(CTX_BARE)],

  // Confirmation flow, in the order the four mails go out.
  [
    'pending-customer-confirm-request',
    buildCustomerConfirmRequest({ pendingId: 12, comp: COMP, reviewUrl: REVIEW_URL }),
  ],
  [
    'pending-customer-confirm-request-pickup',
    buildCustomerConfirmRequest({ pendingId: 13, comp: COMP_PICKUP, reviewUrl: REVIEW_URL }),
  ],
  ['pending-admin-new', buildAdminNewPending({ pendingId: 12, comp: COMP, adminUrl: ADMIN_URL })],
  [
    'pending-customer-confirmed',
    buildCustomerConfirmed({ orderId: 55, comp: COMP, reviewUrl: REVIEW_URL }),
  ],
  [
    'pending-admin-confirmed-by-customer',
    buildAdminConfirmed({ orderId: 55, comp: COMP, adminUrl: ADMIN_URL, via: 'link' }),
  ],
  [
    'pending-admin-confirmed-manually',
    buildAdminConfirmed({
      orderId: 55,
      comp: COMP,
      adminUrl: ADMIN_URL,
      via: 'admin',
      note: 'Kundin hat telefonisch bestätigt.',
    }),
  ],

  // Status notifications.
  [
    'status-with-comment',
    buildStatusMail({
      orderId: 55,
      customerName: 'Erika Musterfrau',
      statusName: 'Versandt',
      comment: 'Paket ging heute raus, DPD-Nr. 0123456789.',
    }),
  ],
  [
    'status-plain',
    buildStatusMail({ orderId: 56, customerName: '', statusName: 'In Bearbeitung' }),
  ],
]

describe('mail templates', () => {
  it.each(CASES)('%s', async (name, mail) => {
    await expect(asPlainMail(mail)).toMatchFileSnapshot(`__mail__/${name}.txt`)
    await expect(`${mail.html}\n`).toMatchFileSnapshot(`__mail__/${name}.html`)
  })
})
