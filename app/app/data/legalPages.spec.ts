import { describe, it, expect } from 'vitest'

import { LEGAL_PAGES, isLegalSlug, legalPage } from './legalPages'

describe('legal pages', () => {
  it('lists the five pages in menu order, each with its own route', () => {
    expect(LEGAL_PAGES.map((p) => [p.slug, p.path])).toStrictEqual([
      ['impressum', '/impressum'],
      ['datenschutz', '/datenschutz'],
      ['agb', '/agb'],
      ['widerruf', '/widerruf'],
      ['versand', '/versand'],
    ])
  })

  it('accepts only known slugs — the slug ends up in SQL and URLs', () => {
    expect(isLegalSlug('agb')).toBe(true)
    expect(isLegalSlug('AGB')).toBe(false)
    expect(isLegalSlug("agb' OR 1=1")).toBe(false)
    expect(isLegalSlug(undefined)).toBe(false)
  })

  it('looks a page up by slug', () => {
    expect(legalPage('widerruf').title).toBe('Widerrufsbelehrung')
  })
})
