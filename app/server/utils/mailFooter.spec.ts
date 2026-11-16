// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The legal footer under every mail. Its data comes from the environment —
 * vitest.config.ts sets fictitious values for the whole suite — so the tests
 * check the assembly: every configured detail present, missing ones left out
 * without leaving gaps, HTML escaped, and a missing configuration reported.
 */
async function load() {
  vi.resetModules()
  return import('./mailFooter')
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('footerText', () => {
  it('lists the full legal company data', async () => {
    const { footerText } = await load()

    expect(footerText()).toBe(
      [
        '—',
        'Musterfirma GmbH',
        'Musterweg 1, 12345 Musterstadt',
        'Geschäftsführer: Max Mustermann · Amtsgericht Musterstadt, HRB 12345',
        'info@example.org',
      ].join('\n'),
    )
  })

  it('adds the VAT id when one is configured', async () => {
    vi.stubEnv('COMPANY_VAT_ID', 'DE123456789')
    const { footerText } = await load()

    expect(footerText()).toContain('USt-IdNr.: DE123456789')
  })

  it('leaves out what is not configured, without empty lines', async () => {
    vi.stubEnv('COMPANY_STREET', '')
    vi.stubEnv('COMPANY_MANAGER', '')
    const { footerText } = await load()

    expect(footerText()).toBe(
      [
        '—',
        'Musterfirma GmbH',
        '12345 Musterstadt',
        'Amtsgericht Musterstadt, HRB 12345',
        'info@example.org',
      ].join('\n'),
    )
  })

  it('omits the invoice note by default', async () => {
    const { footerText } = await load()

    expect(footerText()).not.toContain('keine Rechnung')
  })

  it('appends the invoice note when asked for', async () => {
    const { footerText } = await load()

    expect(footerText(true)).toMatch(
      /info@example\.org\n\nDiese Bestellbestätigung ist keine Rechnung\.$/,
    )
  })
})

describe('footerHtml', () => {
  it('renders the same company data as markup', async () => {
    const { footerHtml } = await load()
    const html = footerHtml()

    expect(html).toContain('<strong>Musterfirma GmbH</strong><br>')
    expect(html).toContain('Geschäftsführer: Max Mustermann · Amtsgericht Musterstadt, HRB 12345')
    expect(html).toContain(
      '<a href="mailto:info@example.org" style="color:#999">info@example.org</a>',
    )
  })

  it('escapes the configured values', async () => {
    vi.stubEnv('COMPANY_NAME', 'Muster GmbH & Co. KG')
    const { footerHtml } = await load()

    expect(footerHtml()).toContain('<strong>Muster GmbH &amp; Co. KG</strong>')
  })

  it('leaves out what is not configured', async () => {
    vi.stubEnv('COMPANY_NAME', '')
    vi.stubEnv('COMPANY_EMAIL', '')
    const { footerHtml } = await load()
    const html = footerHtml()

    expect(html).not.toContain('<strong>')
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('<br><br>')
  })

  it('omits the invoice note by default', async () => {
    const { footerHtml } = await load()

    expect(footerHtml()).not.toContain('keine Rechnung')
  })

  it('appends the invoice note when asked for', async () => {
    const { footerHtml } = await load()

    expect(footerHtml(true)).toContain('Diese Bestellbestätigung ist keine Rechnung.')
  })
})

describe('missing configuration', () => {
  it('is reported once, not on every mail', async () => {
    vi.stubEnv('COMPANY_NAME', '')
    const { footerText, footerHtml } = await load()

    footerText()
    footerHtml()

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('COMPANY_* is not configured'),
    )
  })

  it('stays quiet while the company is configured', async () => {
    const { footerText } = await load()

    footerText()

    expect(console.warn).not.toHaveBeenCalled()
  })
})
