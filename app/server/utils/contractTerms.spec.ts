// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMockDb } from '../../test/helpers/mock-db'

import { loadContractTerms } from './contractTerms'

const getLiveLegalText = vi.hoisted(() => vi.fn())
vi.mock(import('./legalText'), () => ({ getLiveLegalText }))

/**
 * The receipt mail is the customer's durable copy of the terms. What matters:
 * both texts are fetched as live versions (with their number, so the copy is
 * attributable), and a missing or unreadable text never breaks the order.
 */
const live = (slug: string, versionNo: number) => ({
  slug,
  versionId: versionNo * 10,
  versionNo,
  html: `<p>${slug}</p>`,
  bodyMd: `${slug} text`,
  activatedAt: '2026-11-01T00:00:00.000Z',
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('loadContractTerms', () => {
  it('returns the live AGB and Widerrufsbelehrung, in that order', async () => {
    getLiveLegalText.mockImplementation((_db, slug: string) => live(slug, slug === 'agb' ? 3 : 2))
    const db = createMockDb()

    await expect(loadContractTerms(db.pool)).resolves.toStrictEqual([
      {
        slug: 'agb',
        title: 'Allgemeine Geschäftsbedingungen',
        versionNo: 3,
        html: '<p>agb</p>',
        text: 'agb text',
      },
      {
        slug: 'widerruf',
        title: 'Widerrufsbelehrung',
        versionNo: 2,
        html: '<p>widerruf</p>',
        text: 'widerruf text',
      },
    ])
    expect(getLiveLegalText.mock.calls.map((c) => c[1])).toStrictEqual(['agb', 'widerruf'])
  })

  it('leaves out a text that has never been activated, and says so', async () => {
    getLiveLegalText.mockImplementation((_db, slug: string) =>
      slug === 'agb' ? null : live(slug, 1),
    )

    const terms = await loadContractTerms(createMockDb().pool)

    expect(terms.map((t) => t.slug)).toStrictEqual(['widerruf'])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('agb: no live version'))
  })

  it('does not throw when the database fails', async () => {
    getLiveLegalText.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(loadContractTerms(createMockDb().pool)).resolves.toStrictEqual([])
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})
