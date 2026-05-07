/**
 * Customer-facing labels for shipping + payment.
 * Mirrors `app/server/utils/checkoutOptions.ts` for the client.
 */

export type ShippingMethod = 'dpd' | 'dhl' | 'express' | 'direkt' | 'abholung'
export type PaymentMethod = 'vorkasse' | 'rechnung' | 'lastschrift'

export interface ShippingDisplay {
  id: ShippingMethod
  module: string
  description: string
  price: string
}

export const SHIPPING_OPTIONS: ShippingDisplay[] = [
  { id: 'dpd',      module: 'Versand mit DPD',     description: 'Versand mit DPD innerhalb Deutschlands.',                  price: '7,50 EURO' },
  { id: 'dhl',      module: 'Versand mit DHL',     description: 'Versand mit DHL innerhalb Deutschlands. (Standard)',       price: '12,00 EURO' },
  { id: 'express',  module: 'Versand mit EXPRESS', description: 'Tatsächlich anfallende Versandkosten. (Ohne Aufschlag)',   price: 'nach Aufwand' },
  { id: 'direkt',   module: 'Direktzustellung',    description: 'Nach Vereinbarung',                                         price: 'nach Aufwand' },
  { id: 'abholung', module: 'Abholung',            description: 'Nur nach Absprache',                                        price: 'nach Aufwand' },
]

export interface PaymentDisplay {
  id: PaymentMethod
  label: string
  description: string
}

export const PAYMENT_OPTIONS: PaymentDisplay[] = [
  { id: 'vorkasse',    label: 'Bezahlung mit Vorkasse',          description: 'Überweisung im Voraus auf das angegebene Konto.' },
  { id: 'rechnung',    label: 'Bezahlung mit Rechnung',          description: 'Sie erhalten eine Rechnung mit der Lieferung.' },
  { id: 'lastschrift', label: 'Lastschriftverfahren IBAN (DE)',  description: 'Wir buchen den Betrag von Ihrem Konto ab. Eingabe der IBAN erforderlich.' },
]
