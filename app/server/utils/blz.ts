import blzData from '../data/blz.json'
import { normalizeIban } from './iban'

const lookup = blzData as Record<string, string>

export interface IbanInfo {
  iban: string
  blz?: string
  bankName?: string
  country: string
}

/**
 * Inspect an IBAN. For German IBANs, look up the BLZ → bank name mapping
 * (Bundesbank "Bankleitzahlen-Datei", Merkmal=1 main banks; ~99.7% coverage
 * on the existing customer base).
 *
 * Returns { iban, country } even when validation/lookup fails — UI uses this
 * to show whatever info is available without blocking.
 */
export function ibanInfo(rawIban: string): IbanInfo {
  const iban = normalizeIban(rawIban)
  const country = iban.slice(0, 2)
  if (country !== 'DE' || iban.length < 12) {
    return { iban, country }
  }
  const blz = iban.slice(4, 12)
  const bankName = lookup[blz]
  return { iban, country, blz, ...(bankName && { bankName }) }
}
