/**
 * Shipping + Payment options — values mirror the old shop's modules
 * (`old/.../shop/includes/modules/shipping/*.php`, `payment/*.php`)
 * so that orders look identical to the operator.
 */

export type ShippingMethod = 'dpd' | 'dhl' | 'express' | 'direkt' | 'abholung'
export type PaymentMethod = 'vorkasse' | 'rechnung' | 'lastschrift'

export interface ShippingOption {
  /**
   * Label the customer reads — in the mails and in the confirmation views.
   * Same wording as `totalTitle`, only without the colon; the client mirrors it
   * in `app/data/checkoutOptions.ts`.
   */
  module: string
  /** Title used in orders_total `title` (e.g. "Versand mit DPD:") */
  totalTitle: string
  /** Customer-facing description */
  description: string
  /** Net cost in EUR; 0 means "nach Aufwand" (no fixed price) */
  net: number
  /** osCommerce tax_class_id; 2 = 19%; 0 = no tax applied to shipping */
  taxClassId: number
  /** What the customer sees in the picker as price */
  displayPrice: string
}

export const SHIPPING_OPTIONS: Record<ShippingMethod, ShippingOption> = {
  dpd: {
    module: 'Versand mit DPD',
    totalTitle: 'Versand mit DPD:',
    description: 'Versand mit DPD innerhalb Deutschlands.',
    net: 6.3025,
    taxClassId: 2,
    displayPrice: '7,50 EURO',
  },
  dhl: {
    module: 'Versand mit DHL',
    totalTitle: 'Versand mit DHL:',
    description: 'Versand mit DHL innerhalb Deutschlands. (Standard)',
    net: 10.084,
    taxClassId: 2,
    displayPrice: '12,00 EURO',
  },
  express: {
    // Upper case, and deliberately so: this is the only spelling that occurs in
    // the shop's order data. The legacy module contradicts itself — its
    // `$this->title` says "Versand mit Express", but the quote it hands to the
    // checkout says "Versand mit EXPRESS", and only the latter is ever written.
    // Every other module has both fields identical.
    module: 'Versand mit EXPRESS',
    totalTitle: 'Versand mit EXPRESS:',
    description: 'Tatsächlich anfallende Versandkosten. (Ohne Aufschlag)',
    net: 0,
    taxClassId: 0,
    displayPrice: 'nach Aufwand',
  },
  direkt: {
    module: 'Direktzustellung',
    totalTitle: 'Direktzustellung:',
    description: 'Nach Vereinbarung',
    net: 0,
    taxClassId: 0,
    displayPrice: 'nach Aufwand',
  },
  abholung: {
    module: 'Abholung',
    totalTitle: 'Abholung:',
    description: 'Nur nach Absprache',
    net: 0,
    taxClassId: 0,
    displayPrice: 'nach Aufwand',
  },
}

export const SHIPPING_ORDER: ShippingMethod[] = ['dpd', 'dhl', 'express', 'direkt', 'abholung']

export interface PaymentOption {
  label: string // stored in orders.payment_method, exactly as the old shop does
}

export const PAYMENT_OPTIONS: Record<PaymentMethod, PaymentOption> = {
  vorkasse: { label: 'Bezahlung mit Vorkasse' },
  rechnung: { label: 'Bezahlung mit Rechnung' },
  lastschrift: { label: 'Lastschriftverfahren IBAN (DE)' },
}

export const PAYMENT_ORDER: PaymentMethod[] = ['vorkasse', 'rechnung', 'lastschrift']
