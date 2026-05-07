import { ibanInfo } from '../../utils/blz'
import { isValidIban } from '../../utils/iban'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const raw = typeof q.iban === 'string' ? q.iban : ''
  if (!raw) return { ok: false }
  const info = ibanInfo(raw)
  return {
    ok: true,
    country: info.country,
    blz: info.blz,
    bankName: info.bankName,
    valid: isValidIban(info.iban),
  }
})
