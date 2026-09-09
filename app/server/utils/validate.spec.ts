// @vitest-environment node
import { describe, it, expect } from 'vitest'

import '../../test/setup-server'

import { parseRegister, parseLogin, parseOrder } from './validate'

const VALID_REGISTER = {
  gender: 'm',
  firstname: 'Max',
  lastname: 'Mustermann',
  dob: '1980-04-01',
  email: 'Max@Example.ORG',
  telephone: '0711 1234567',
  password: 'supersecret',
  street: 'Im Winkel 11',
  postcode: '88422',
  city: 'Dürnau',
  country: 'DE',
}

/** parseX throws H3 errors; this pulls the message out for readable assertions. */
function messageOf(fn: () => unknown): string {
  try {
    fn()
  } catch (err: unknown) {
    return (err as { statusMessage?: string }).statusMessage ?? ''
  }
  throw new Error('expected the call to throw')
}

describe('parseRegister', () => {
  it('accepts a complete registration and normalizes the email', () => {
    expect(parseRegister(VALID_REGISTER)).toStrictEqual({
      ...VALID_REGISTER,
      email: 'max@example.org',
    })
  })

  it('trims surrounding whitespace on text fields', () => {
    const parsed = parseRegister({ ...VALID_REGISTER, firstname: '  Max  ' })
    expect(parsed.firstname).toBe('Max')
  })

  it.each([
    ['a non-object body', null, 'Ungültige Daten'],
    ['an unknown gender', { ...VALID_REGISTER, gender: 'x' }, 'Anrede: ungültig'],
    ['a malformed email', { ...VALID_REGISTER, email: 'no-at-sign' }, 'E-Mail: ungültiges Format'],
    [
      'a password below the minimum length',
      { ...VALID_REGISTER, password: 'short' },
      'Passwort: mindestens 8 Zeichen',
    ],
    [
      'a password above the maximum length',
      { ...VALID_REGISTER, password: 'x'.repeat(129) },
      'Passwort: maximal 128 Zeichen',
    ],
    [
      'a date of birth in the wrong format',
      { ...VALID_REGISTER, dob: '01.04.1980' },
      'Geburtsdatum: Format YYYY-MM-DD',
    ],
    ['an unsupported country', { ...VALID_REGISTER, country: 'FR' }, 'Land: nur DE/AT/CH'],
    ['a non-string field', { ...VALID_REGISTER, firstname: 42 }, 'Vorname: erwartet Text'],
    ['an empty field', { ...VALID_REGISTER, city: '   ' }, 'Ort: darf nicht leer sein'],
    [
      'a field beyond its column length',
      { ...VALID_REGISTER, lastname: 'x'.repeat(33) },
      'Nachname: maximal 32 Zeichen',
    ],
  ])('rejects %s', (_label, body, message) => {
    expect(messageOf(() => parseRegister(body))).toBe(message)
  })
})

describe('parseLogin', () => {
  it('accepts credentials and lower-cases the email', () => {
    expect(parseLogin({ email: 'Max@Example.ORG', password: 'pw' })).toStrictEqual({
      email: 'max@example.org',
      password: 'pw',
    })
  })

  it.each([
    ['a non-object body', 'nope', 'Ungültige Daten'],
    ['a missing password', { email: 'max@example.org' }, 'Passwort: erforderlich'],
    ['an empty password', { email: 'max@example.org', password: '' }, 'Passwort: erforderlich'],
  ])('rejects %s', (_label, body, message) => {
    expect(messageOf(() => parseLogin(body))).toBe(message)
  })
})

describe('parseOrder', () => {
  const VALID_ORDER = {
    items: [{ productId: '123', quantity: 2 }],
    shippingMethod: 'dpd',
    paymentMethod: 'vorkasse',
  }

  it('accepts a minimal order', () => {
    expect(parseOrder(VALID_ORDER)).toStrictEqual(VALID_ORDER)
  })

  it('keeps an explicit variantIndex and drops it when absent', () => {
    expect(
      parseOrder({ ...VALID_ORDER, items: [{ productId: '1', quantity: 1 }] }).items[0],
    ).toStrictEqual({ productId: '1', quantity: 1 })
    expect(
      parseOrder({ ...VALID_ORDER, items: [{ productId: '1', quantity: 1, variantIndex: 2 }] })
        .items[0],
    ).toStrictEqual({ productId: '1', quantity: 1, variantIndex: 2 })
  })

  it('truncates notes to the column length and omits empty notes', () => {
    expect(parseOrder({ ...VALID_ORDER, notes: 'x'.repeat(600) }).notes).toHaveLength(500)
    expect(parseOrder({ ...VALID_ORDER, notes: 42 }).notes).toBeUndefined()
  })

  it('requires bank details for Lastschrift and normalizes the IBAN', () => {
    const parsed = parseOrder({
      ...VALID_ORDER,
      paymentMethod: 'lastschrift',
      bankDetails: { accountHolder: ' Max Mustermann ', iban: 'de89 3704 0044 0532 0130 00' },
    })
    expect(parsed.bankDetails).toStrictEqual({
      accountHolder: 'Max Mustermann',
      iban: 'DE89370400440532013000',
    })
  })

  it.each([
    ['a non-object body', null, 'Ungültige Daten'],
    ['an empty cart', { ...VALID_ORDER, items: [] }, 'Bestellliste leer'],
    ['a non-array items field', { ...VALID_ORDER, items: 'nope' }, 'Bestellliste leer'],
    ['a non-object item', { ...VALID_ORDER, items: [null] }, 'Position 1: ungültig'],
    [
      'a non-numeric productId',
      { ...VALID_ORDER, items: [{ productId: 'abc', quantity: 1 }] },
      'Position 1: productId',
    ],
    [
      'a zero quantity',
      { ...VALID_ORDER, items: [{ productId: '1', quantity: 0 }] },
      'Position 1: Menge',
    ],
    [
      'a quantity above the cap',
      { ...VALID_ORDER, items: [{ productId: '1', quantity: 10000 }] },
      'Position 1: Menge',
    ],
    [
      'a fractional quantity',
      { ...VALID_ORDER, items: [{ productId: '1', quantity: 1.5 }] },
      'Position 1: Menge',
    ],
    [
      'a negative variantIndex',
      { ...VALID_ORDER, items: [{ productId: '1', quantity: 1, variantIndex: -1 }] },
      'Position 1: variantIndex',
    ],
    [
      'an unknown shipping method',
      { ...VALID_ORDER, shippingMethod: 'taube' },
      'Versandart: ungültig',
    ],
    [
      'an unknown payment method',
      { ...VALID_ORDER, paymentMethod: 'bitcoin' },
      'Zahlungsart: ungültig',
    ],
    [
      'Lastschrift without bank details',
      { ...VALID_ORDER, paymentMethod: 'lastschrift' },
      'Bankverbindung erforderlich',
    ],
    [
      'Lastschrift with an invalid IBAN',
      {
        ...VALID_ORDER,
        paymentMethod: 'lastschrift',
        bankDetails: { accountHolder: 'Max', iban: 'DE00 0000 0000 0000 0000 00' },
      },
      'IBAN: ungültig oder nicht unterstütztes Land (DE/AT/CH/LI)',
    ],
  ])('rejects %s', (_label, body, message) => {
    expect(messageOf(() => parseOrder(body))).toBe(message)
  })

  it('reports the position number of the offending item', () => {
    expect(
      messageOf(() =>
        parseOrder({
          ...VALID_ORDER,
          items: [
            { productId: '1', quantity: 1 },
            { productId: 'x', quantity: 1 },
          ],
        }),
      ),
    ).toBe('Position 2: productId')
  })
})
