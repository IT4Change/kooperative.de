// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../../test/setup-server'
import { callHandler } from '../../../test/helpers/event'
import { getAdminUser } from '../../utils/adminAuth'
import { MAX_MARKDOWN_LENGTH } from '../../utils/legalRequest'

import versionList from './api/legal/[slug]/index.get'
import activate from './api/legal/[slug]/versions/[id]/activate.post'
import versionDetail from './api/legal/[slug]/versions/[id].get'
import createVersion from './api/legal/[slug]/versions.post'
import overview from './api/legal/index.get'
import preview from './api/legal/preview.post'

const listLegalOverview = vi.hoisted(() => vi.fn())
const listLegalVersions = vi.hoisted(() => vi.fn())
const getLegalVersion = vi.hoisted(() => vi.fn())
const createLegalVersion = vi.hoisted(() => vi.fn())
const activateLegalVersion = vi.hoisted(() => vi.fn())
vi.mock(import('../../utils/legalText'), () => ({
  listLegalOverview,
  listLegalVersions,
  getLegalVersion,
  createLegalVersion,
  activateLegalVersion,
}))

/**
 * The admin side of the legal texts. The storage logic has its own spec
 * (utils/legalText.spec.ts); here it is about what reaches it: validated slugs
 * and ids, a bounded text, and the operator's name for the audit trail.
 */
const pool = { marker: 'pool' }
const AUTH = { authorization: `Basic ${Buffer.from('betrieb:geheim').toString('base64')}` }

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, { useDB: () => pool, getAdminUser })
})

describe('GET /admin/api/legal', () => {
  it('returns the overview', async () => {
    listLegalOverview.mockResolvedValue([{ slug: 'impressum' }])

    await expect(callHandler(overview)).resolves.toStrictEqual([{ slug: 'impressum' }])
    expect(listLegalOverview).toHaveBeenCalledWith(pool)
  })
})

describe('GET /admin/api/legal/[slug]', () => {
  it('returns the versions of a page with its title', async () => {
    listLegalVersions.mockResolvedValue([{ id: 1 }])

    await expect(callHandler(versionList, { params: { slug: 'agb' } })).resolves.toStrictEqual({
      slug: 'agb',
      title: 'Allgemeine Geschäftsbedingungen',
      versions: [{ id: 1 }],
    })
  })

  it('knows only the legal pages', async () => {
    await expect(callHandler(versionList, { params: { slug: 'blog' } })).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(listLegalVersions).not.toHaveBeenCalled()
  })
})

describe('GET /admin/api/legal/[slug]/versions/[id]', () => {
  it('returns the version', async () => {
    getLegalVersion.mockResolvedValue({ id: 5, bodyMd: 'x' })

    await expect(
      callHandler(versionDetail, { params: { slug: 'widerruf', id: '5' } }),
    ).resolves.toStrictEqual({ id: 5, bodyMd: 'x' })
    expect(getLegalVersion).toHaveBeenCalledWith(pool, 'widerruf', 5)
  })

  it('answers 404 for a version of another page', async () => {
    getLegalVersion.mockResolvedValue(null)

    await expect(
      callHandler(versionDetail, { params: { slug: 'widerruf', id: '5' } }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it.each(['0', '-1', '1.5', 'abc'])('rejects the id %s', async (id) => {
    await expect(
      callHandler(versionDetail, { params: { slug: 'widerruf', id } }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('POST /admin/api/legal/[slug]/versions', () => {
  it('stores the text as a new version in the name of the operator', async () => {
    createLegalVersion.mockResolvedValue({ id: 12, versionNo: 3 })

    const res = await callHandler(createVersion, {
      method: 'POST',
      params: { slug: 'datenschutz' },
      headers: AUTH,
      body: { bodyMd: 'Hoster: [[Name]]', note: '  Hoster offen  ' },
    })

    expect(res).toStrictEqual({ id: 12, versionNo: 3, placeholders: ['Name'] })
    expect(createLegalVersion).toHaveBeenCalledWith(
      pool,
      {
        slug: 'datenschutz',
        bodyMd: 'Hoster: [[Name]]',
        note: 'Hoster offen',
        createdBy: 'betrieb',
      },
      { remoteIp: '127.0.0.1' },
    )
  })

  it('caps the note and tolerates a missing one', async () => {
    createLegalVersion.mockResolvedValue({ id: 1, versionNo: 1 })

    await callHandler(createVersion, {
      method: 'POST',
      params: { slug: 'agb' },
      body: { bodyMd: 'x', note: 'n'.repeat(600) },
    })
    await callHandler(createVersion, {
      method: 'POST',
      params: { slug: 'agb' },
      body: { bodyMd: 'x' },
    })

    expect(createLegalVersion.mock.calls[0][1].note).toHaveLength(500)
    expect(createLegalVersion.mock.calls[1][1]).toMatchObject({ note: '', createdBy: 'admin' })
  })

  it.each([
    ['no body', undefined, 400],
    ['an empty text', { bodyMd: '   ' }, 400],
    ['a text that is not a string', { bodyMd: 42 }, 400],
    ['an oversized text', { bodyMd: 'x'.repeat(MAX_MARKDOWN_LENGTH + 1) }, 413],
  ])('rejects %s', async (_label, body, status) => {
    await expect(
      callHandler(createVersion, { method: 'POST', params: { slug: 'agb' }, body }),
    ).rejects.toMatchObject({ statusCode: status })
    expect(createLegalVersion).not.toHaveBeenCalled()
  })

  it('answers 409 when a concurrent save took the version number', async () => {
    createLegalVersion.mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }))

    await expect(
      callHandler(createVersion, {
        method: 'POST',
        params: { slug: 'agb' },
        body: { bodyMd: 'x' },
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lets any other database error through', async () => {
    createLegalVersion.mockRejectedValue(new Error('gone'))

    await expect(
      callHandler(createVersion, {
        method: 'POST',
        params: { slug: 'agb' },
        body: { bodyMd: 'x' },
      }),
    ).rejects.toThrow('gone')
  })
})

describe('POST /admin/api/legal/[slug]/versions/[id]/activate', () => {
  it('puts the version live in the name of the operator', async () => {
    activateLegalVersion.mockResolvedValue(true)

    await expect(
      callHandler(activate, {
        method: 'POST',
        params: { slug: 'impressum', id: '9' },
        headers: AUTH,
      }),
    ).resolves.toStrictEqual({ ok: true, slug: 'impressum', versionId: 9 })
    expect(activateLegalVersion).toHaveBeenCalledWith(pool, 'impressum', 9, 'betrieb', {
      remoteIp: '127.0.0.1',
    })
  })

  it('answers 404 when the version does not belong to the page', async () => {
    activateLegalVersion.mockResolvedValue(false)

    await expect(
      callHandler(activate, { method: 'POST', params: { slug: 'impressum', id: '9' } }),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(activateLegalVersion.mock.calls[0][3]).toBe('admin')
  })
})

describe('POST /admin/api/legal/preview', () => {
  it('renders like a save would, and lists the open placeholders', async () => {
    await expect(
      callHandler(preview, { method: 'POST', body: { bodyMd: '## Hoster\n\n[[Name]]' } }),
    ).resolves.toStrictEqual({
      html: '<h2>Hoster</h2>\n<p><mark class="legal-placeholder">[[Name]]</mark></p>\n',
      placeholders: ['Name'],
    })
  })

  it('rejects an empty text', async () => {
    await expect(
      callHandler(preview, { method: 'POST', body: { bodyMd: '' } }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
