/**
 * Legal company footer for outgoing mails. Business mails need the company's
 * mandatory details (§ 35a GmbHG, § 125a HGB) just like business letters.
 *
 * The details come from the server environment, not from this repository —
 * it is public, and they include personal data (the managing director's name,
 * a personal mail address). Set on the server:
 *
 *   COMPANY_NAME      legal name of the seller
 *   COMPANY_STREET    street and number
 *   COMPANY_CITY      postcode and city
 *   COMPANY_MANAGER   managing director(s)
 *   COMPANY_REGISTER  register court and number
 *   COMPANY_EMAIL     contact address
 *   COMPANY_VAT_ID    optional, VAT identification number
 *
 * Read on every call, so a changed environment takes effect without a rebuild.
 * Missing values are left out of the footer; a missing company name is logged,
 * because a business mail without it lacks its mandatory details.
 */
export interface Company {
  name: string
  street: string
  city: string
  manager: string
  register: string
  email: string
  vatId: string
}

let warned = false

export function company(): Company {
  const env = (key: string) => (process.env[key] ?? '').trim()
  const data = {
    name: env('COMPANY_NAME'),
    street: env('COMPANY_STREET'),
    city: env('COMPANY_CITY'),
    manager: env('COMPANY_MANAGER'),
    register: env('COMPANY_REGISTER'),
    email: env('COMPANY_EMAIL'),
    vatId: env('COMPANY_VAT_ID'),
  }
  if (!data.name && !warned) {
    warned = true
    console.warn('[mail] COMPANY_* is not configured — mails go out without the company details')
  }
  return data
}

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

/** The footer's lines, without the empty ones. */
function lines(c: Company): { address: string; legal: string; vat: string } {
  return {
    address: [c.street, c.city].filter(Boolean).join(', '),
    legal: [c.manager && `Geschäftsführer: ${c.manager}`, c.register].filter(Boolean).join(' · '),
    vat: c.vatId && `USt-IdNr.: ${c.vatId}`,
  }
}

export function footerText(withInvoiceNote = false): string {
  const c = company()
  const l = lines(c)
  const out = ['—', c.name, l.address, l.legal, l.vat, c.email].filter(Boolean)
  if (withInvoiceNote) out.push('', 'Diese Bestellbestätigung ist keine Rechnung.')
  return out.join('\n')
}

export function footerHtml(withInvoiceNote = false): string {
  const c = company()
  const l = lines(c)
  const rows = [
    c.name && `<strong>${esc(c.name)}</strong>`,
    esc(l.address),
    esc(l.legal),
    esc(l.vat),
    c.email && `<a href="mailto:${esc(c.email)}" style="color:#999">${esc(c.email)}</a>`,
  ].filter(Boolean)
  const note = withInvoiceNote
    ? '<br><span style="color:#bbb">Diese Bestellbestätigung ist keine Rechnung.</span>'
    : ''
  return `<hr style="border:0;border-top:1px solid #eee;margin:16px 0">
    <p style="font-size:11px;color:#999;line-height:1.6;margin:0">
      ${rows.join('<br>\n      ')}${note}
    </p>`
}
