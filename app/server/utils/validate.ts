/**
 * Lightweight runtime validators for the osCommerce-shaped customer/order data.
 * Length limits derived from the actual table schema (latin1 columns).
 */

export interface RegisterInput {
  gender: 'm' | 'f' | 'd'
  firstname: string
  lastname: string
  dob: string         // ISO date YYYY-MM-DD
  email: string
  telephone: string
  password: string
  street: string
  postcode: string
  city: string
  country: 'DE' | 'AT' | 'CH'
}

export interface LoginInput {
  email: string
  password: string
}

export interface OrderInput {
  items: { productId: string, quantity: number, variantIndex?: number }[]
  notes?: string
  shippingMethod: import('./checkoutOptions').ShippingMethod
  paymentMethod: import('./checkoutOptions').PaymentMethod
}

function asTrimmedString(value: unknown, max: number, field: string): string {
  if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: `${field}: erwartet Text` })
  const v = value.trim()
  if (!v) throw createError({ statusCode: 400, statusMessage: `${field}: darf nicht leer sein` })
  if (v.length > max) throw createError({ statusCode: 400, statusMessage: `${field}: maximal ${max} Zeichen` })
  return v
}

export function parseRegister(body: unknown): RegisterInput {
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Ungültige Daten' })
  const b = body as Record<string, unknown>
  const gender = b.gender
  if (gender !== 'm' && gender !== 'f' && gender !== 'd') {
    throw createError({ statusCode: 400, statusMessage: 'Anrede: ungültig' })
  }
  const email = asTrimmedString(b.email, 96, 'E-Mail').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'E-Mail: ungültiges Format' })
  }
  const password = b.password
  if (typeof password !== 'string' || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Passwort: mindestens 8 Zeichen' })
  }
  if (password.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'Passwort: maximal 128 Zeichen' })
  }
  const dob = asTrimmedString(b.dob, 10, 'Geburtsdatum')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    throw createError({ statusCode: 400, statusMessage: 'Geburtsdatum: Format YYYY-MM-DD' })
  }
  const country = b.country
  if (country !== 'DE' && country !== 'AT' && country !== 'CH') {
    throw createError({ statusCode: 400, statusMessage: 'Land: nur DE/AT/CH' })
  }
  return {
    gender,
    firstname: asTrimmedString(b.firstname, 32, 'Vorname'),
    lastname: asTrimmedString(b.lastname, 32, 'Nachname'),
    dob,
    email,
    telephone: asTrimmedString(b.telephone, 32, 'Telefon'),
    password,
    street: asTrimmedString(b.street, 64, 'Straße'),
    postcode: asTrimmedString(b.postcode, 10, 'PLZ'),
    city: asTrimmedString(b.city, 32, 'Ort'),
    country,
  }
}

export function parseLogin(body: unknown): LoginInput {
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Ungültige Daten' })
  const b = body as Record<string, unknown>
  const email = asTrimmedString(b.email, 96, 'E-Mail').toLowerCase()
  const password = b.password
  if (typeof password !== 'string' || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Passwort: erforderlich' })
  }
  return { email, password }
}

export function parseOrder(body: unknown): OrderInput {
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Ungültige Daten' })
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Bestellliste leer' })
  }
  const items = b.items.map((raw, idx) => {
    if (!raw || typeof raw !== 'object') {
      throw createError({ statusCode: 400, statusMessage: `Position ${idx + 1}: ungültig` })
    }
    const it = raw as Record<string, unknown>
    if (typeof it.productId !== 'string' || !/^\d+$/.test(it.productId)) {
      throw createError({ statusCode: 400, statusMessage: `Position ${idx + 1}: productId` })
    }
    const quantity = typeof it.quantity === 'number' ? it.quantity : 0
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      throw createError({ statusCode: 400, statusMessage: `Position ${idx + 1}: Menge` })
    }
    let variantIndex: number | undefined
    if (it.variantIndex !== undefined) {
      if (!Number.isInteger(it.variantIndex) || (it.variantIndex as number) < 0) {
        throw createError({ statusCode: 400, statusMessage: `Position ${idx + 1}: variantIndex` })
      }
      variantIndex = it.variantIndex as number
    }
    return { productId: it.productId, quantity, ...(variantIndex !== undefined && { variantIndex }) }
  })
  const notes = typeof b.notes === 'string' ? b.notes.slice(0, 500) : undefined
  const allowedShipping = ['dpd', 'dhl', 'express', 'direkt', 'abholung'] as const
  if (!allowedShipping.includes(b.shippingMethod as typeof allowedShipping[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Versandart: ungültig' })
  }
  const allowedPayment = ['vorkasse', 'rechnung'] as const
  if (!allowedPayment.includes(b.paymentMethod as typeof allowedPayment[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Zahlungsart: ungültig' })
  }
  return {
    items,
    ...(notes && { notes }),
    shippingMethod: b.shippingMethod as OrderInput['shippingMethod'],
    paymentMethod: b.paymentMethod as OrderInput['paymentMethod'],
  }
}
