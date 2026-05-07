/**
 * Shipping + Payment options — values mirror the old shop's modules
 * (`old/.../shop/includes/modules/shipping/*.php`, `payment/*.php`)
 * so that orders look identical to the operator.
 */

export type ShippingMethod = 'dpd' | 'dhl' | 'express' | 'direkt' | 'abholung'
export type PaymentMethod = 'vorkasse' | 'rechnung'

export interface ShippingOption {
  /** Module heading (orders_total `text` prefix is taken from `title`) */
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
    net: 10.0840,
    taxClassId: 2,
    displayPrice: '12,00 EURO',
  },
  express: {
    module: 'Versand mit Express',
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
  label: string  // stored in orders.payment_method, exactly as the old shop does
}

export const PAYMENT_OPTIONS: Record<PaymentMethod, PaymentOption> = {
  vorkasse: { label: 'Bezahlung mit Vorkasse' },
  rechnung: { label: 'Bezahlung mit Rechnung' },
}

export const PAYMENT_ORDER: PaymentMethod[] = ['vorkasse', 'rechnung']
