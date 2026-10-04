// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../../test/setup-server'
import { callHandler } from '../../../test/helpers/event'

import legalText from './[slug].get'

const getLiveLegalText = vi.hoisted(() => vi.fn())
vi.mock(import('../../utils/legalText'), () => ({ getLiveLegalText }))

/**
 * The public read of a legal text. A known page always answers, so the page can
 * render — with the live version, or with `html: null` when there is none or
 * the database is down. The texts are not in this repository, so there is no
 * built-in copy to fall back to.
 */
const pool = { marker: 'pool' }
const EMPTY = { html: null, versionNo: null, activatedAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, { useDB: () => pool })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('GET /api/legal/[slug]', () => {
  it('serves the live version', async () => {
    getLiveLegalText.mockResolvedValue({
      slug: 'agb',
      versionId: 7,
      versionNo: 3,
      html: '<p>AGB</p>',
      activatedAt: '2026-10-01T00:00:00.000Z',
    })

    await expect(callHandler(legalText, { params: { slug: 'agb' } })).resolves.toStrictEqual({
      slug: 'agb',
      title: 'Allgemeine Geschäftsbedingungen',
      html: '<p>AGB</p>',
      versionNo: 3,
      activatedAt: '2026-10-01T00:00:00.000Z',
    })
    expect(getLiveLegalText).toHaveBeenCalledWith(pool, 'agb')
  })

  it('answers without text while no version is live', async () => {
    getLiveLegalText.mockResolvedValue(null)

    await expect(callHandler(legalText, { params: { slug: 'impressum' } })).resolves.toStrictEqual({
      slug: 'impressum',
      title: 'Impressum',
      ...EMPTY,
    })
  })

  it('answers without text when the database fails, and says so in the log', async () => {
    getLiveLegalText.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      callHandler(legalText, { params: { slug: 'datenschutz' } }),
    ).resolves.toMatchObject(EMPTY)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[legal] datenschutz'),
      expect.any(Error),
    )
  })

  it('answers 404 for anything that is not a legal page', async () => {
    await expect(callHandler(legalText, { params: { slug: 'admin' } })).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(getLiveLegalText).not.toHaveBeenCalled()
  })
})
