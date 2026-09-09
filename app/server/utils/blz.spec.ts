// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { ibanInfo } from './blz'

describe('ibanInfo', () => {
  it('extracts the BLZ and resolves the bank name for a German IBAN', () => {
    // 37040044 = Commerzbank Köln, present in the Bundesbank BLZ file.
    const info = ibanInfo('DE89 3704 0044 0532 0130 00')
    expect(info.country).toBe('DE')
    expect(info.blz).toBe('37040044')
    expect(info.bankName).toBeTypeOf('string')
    expect(info.iban).toBe('DE89370400440532013000')
  })

  it('returns the BLZ but no bank name when the code is unknown', () => {
    const info = ibanInfo('DE00 0000 0000 0000 0000 00')
    expect(info.blz).toBe('00000000')
    expect(info.bankName).toBeUndefined()
  })

  it('skips the lookup for non-German IBANs', () => {
    const info = ibanInfo('AT61 1904 3002 3457 3201')
    expect(info).toStrictEqual({ iban: 'AT611904300234573201', country: 'AT' })
  })

  it('skips the lookup when the IBAN is too short to contain a BLZ', () => {
    const info = ibanInfo('DE8937')
    expect(info).toStrictEqual({ iban: 'DE8937', country: 'DE' })
  })

  it('never throws on garbage input', () => {
    expect(ibanInfo('')).toStrictEqual({ iban: '', country: '' })
  })
})
