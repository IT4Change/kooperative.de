/**
 * IBAN normalization + validation (basic format + ISO 13616 mod-97 check).
 * Sufficient for catching typos; does not verify that the account exists.
 */

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

const IBAN_LENGTHS: Record<string, number> = {
  DE: 22,
  AT: 20,
  CH: 21,
  LI: 21,
  // Limit to the countries we accept; reject everything else for safety.
}

export function isValidIban(rawIban: string): boolean {
  const iban = normalizeIban(rawIban)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false
  const country = iban.slice(0, 2)
  const expectedLen = IBAN_LENGTHS[country]
  if (!expectedLen || iban.length !== expectedLen) return false

  // Move first 4 chars to end, replace letters with their digit pair, mod 97 == 1
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const digits = rearranged.split('').map((ch) => {
    const code = ch.charCodeAt(0)
    if (code >= 48 && code <= 57) return ch          // 0-9
    if (code >= 65 && code <= 90) return String(code - 55) // A=10 ... Z=35
    return ''
  }).join('')

  // mod 97 on a long numeric string in chunks
  let remainder = 0
  for (let i = 0; i < digits.length; i += 7) {
    remainder = parseInt(String(remainder) + digits.slice(i, i + 7), 10) % 97
  }
  return remainder === 1
}

/** Mask an IBAN for display: keep country code + last 4 digits, replace middle with •. */
export function maskIban(rawIban: string): string {
  const iban = normalizeIban(rawIban)
  if (iban.length < 8) return '••••'
  return iban.slice(0, 4) + ' •••• •••• ' + iban.slice(-4)
}
