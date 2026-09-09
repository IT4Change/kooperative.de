// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { COMPANY, footerText, footerHtml } from './mailFooter'

describe('footerText', () => {
  it('lists the full legal company data', () => {
    const text = footerText()
    expect(text).toContain(COMPANY.name)
    expect(text).toContain(`${COMPANY.street}, ${COMPANY.city}`)
    expect(text).toContain(COMPANY.manager)
    expect(text).toContain(COMPANY.register)
    expect(text).toContain(COMPANY.email)
  })

  it('omits the invoice note by default', () => {
    expect(footerText()).not.toContain('keine Rechnung')
  })

  it('appends the invoice note when asked for', () => {
    expect(footerText(true)).toContain('Diese Bestellbestätigung ist keine Rechnung.')
  })
})

describe('footerHtml', () => {
  it('renders the same company data as markup', () => {
    const html = footerHtml()
    expect(html).toContain(`<strong>${COMPANY.name}</strong>`)
    expect(html).toContain(`mailto:${COMPANY.email}`)
  })

  it('omits the invoice note by default', () => {
    expect(footerHtml()).not.toContain('keine Rechnung')
  })

  it('appends the invoice note when asked for', () => {
    expect(footerHtml(true)).toContain('Diese Bestellbestätigung ist keine Rechnung.')
  })
})
