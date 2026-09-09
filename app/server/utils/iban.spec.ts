// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { normalizeIban, isValidIban, maskIban } from './iban'

describe('normalizeIban', () => {
  it('strips all whitespace and upper-cases', () => {
    expect(normalizeIban(' de89 3704 0044 0532 0130 00 ')).toBe('DE89370400440532013000')
  })

  it('leaves an already normalized IBAN untouched', () => {
    expect(normalizeIban('AT611904300234573201')).toBe('AT611904300234573201')
  })

  it('returns an empty string for an empty input', () => {
    expect(normalizeIban('')).toBe('')
  })
})

describe('isValidIban', () => {
  it.each([
    ['DE89 3704 0044 0532 0130 00', 'DE'],
    ['AT61 1904 3002 3457 3201', 'AT'],
    ['CH93 0076 2011 6238 5295 7', 'CH'],
    ['LI21 0881 0000 2324 013A A', 'LI'],
  ])('accepts the valid %s IBAN (%s)', (iban) => {
    expect(isValidIban(iban)).toBe(true)
  })

  it('rejects an IBAN whose check digits do not match', () => {
    // Same as the valid DE example with the check digits changed.
    expect(isValidIban('DE90 3704 0044 0532 0130 00')).toBe(false)
  })

  it('rejects a country we do not accept, even when the checksum is valid', () => {
    // Valid GB IBAN — deliberately unsupported, see IBAN_LENGTHS.
    expect(isValidIban('GB82 WEST 1234 5698 7654 32')).toBe(false)
  })

  it('rejects an IBAN of the wrong length for its country', () => {
    expect(isValidIban('DE8937040044053201300')).toBe(false)
  })

  it.each([
    ['lower-case country code is normalized first', 'de89370400440532013000', true],
    ['missing check digits', 'DEXX370400440532013000', false],
    ['non-alphanumeric characters', 'DE89-3704-0044-0532-0130-00', false],
    ['empty string', '', false],
  ])('%s', (_label, input, expected) => {
    expect(isValidIban(input)).toBe(expected)
  })
})

describe('maskIban', () => {
  it('keeps the first four and last four characters', () => {
    expect(maskIban('DE89 3704 0044 0532 0130 00')).toBe('DE89 •••• •••• 3000')
  })

  it('masks completely when the input is too short to mask meaningfully', () => {
    expect(maskIban('DE8937')).toBe('••••')
  })
})
