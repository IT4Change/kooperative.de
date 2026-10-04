// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../test/setup-server'
import { createMockDb } from '../../test/helpers/mock-db'

import {
  activateLegalVersion,
  createLegalVersion,
  getLegalVersion,
  getLiveLegalText,
  listLegalOverview,
  listLegalVersions,
} from './legalText'

const dbInsert = vi.hoisted(() => vi.fn())
const dbUpdate = vi.hoisted(() => vi.fn())
vi.mock(import('./dbWrite'), () => ({ dbInsert, dbUpdate }))

/**
 * The versioned legal texts. What matters: a version, once stored, never
 * changes; and exactly one is live per page, switching is one pointer write
 * plus a log row.
 */

const T1 = '2026-10-01T08:00:00.000Z'
const T2 = '2026-10-02T09:30:00.000Z'

function versionRow(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    version_no: 2,
    note: 'Hoster ergänzt',
    created_by: 'betrieb',
    created_at: T2,
    body_md: '## A\n\n[[Hoster]] und [[Frist]] und [[Hoster]]',
    body_html: '<h2>A</h2>',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  dbInsert.mockResolvedValue(1)
  dbUpdate.mockResolvedValue(1)
})

describe('getLiveLegalText', () => {
  it('returns the version the pointer names', async () => {
    const db = createMockDb([
      {
        match: 'FROM koop_legal_text_live l',
        rows: [{ id: 7, version_no: 2, body_html: '<p>x</p>', activated_at: T1 }],
      },
    ])

    await expect(getLiveLegalText(db.pool, 'agb')).resolves.toStrictEqual({
      slug: 'agb',
      versionId: 7,
      versionNo: 2,
      html: '<p>x</p>',
      activatedAt: T1,
    })
    expect(db.calls[0].params).toStrictEqual(['agb'])
  })

  it('is null while nothing has been activated', async () => {
    await expect(getLiveLegalText(createMockDb().pool, 'agb')).resolves.toBeNull()
  })
})

describe('listLegalOverview', () => {
  it('lists every page in menu order, including pages without any version', async () => {
    const db = createMockDb([
      {
        match: 'GROUP BY slug',
        rows: [
          { slug: 'impressum', n: 2, newest: 2 },
          { slug: 'agb', n: 3, newest: 3 },
          { slug: 'versand', n: 1, newest: 1 },
        ],
      },
      {
        match: 'FROM koop_legal_text_live l',
        rows: [
          {
            slug: 'impressum',
            version_id: 11,
            version_no: 2,
            activated_by: 'system',
            activated_at: T1,
          },
          { slug: 'agb', version_id: 21, version_no: 1, activated_by: 'betrieb', activated_at: T2 },
        ],
      },
    ])

    const rows = await listLegalOverview(db.pool)

    expect(
      rows.map((r) => [r.slug, r.versionCount, r.live?.versionNo ?? null, r.hasNewerDraft]),
    ).toStrictEqual([
      ['impressum', 2, 2, false], // newest is live
      ['datenschutz', 0, null, false], // nothing at all
      ['agb', 3, 1, true], // v2, v3 wait
      ['widerruf', 0, null, false],
      ['versand', 1, null, true], // a version, none live
    ])
    expect(rows[0]).toMatchObject({
      title: 'Impressum',
      live: { versionId: 11, activatedBy: 'system', activatedAt: T1 },
    })
  })
})

describe('listLegalVersions', () => {
  it('marks the live version and counts open placeholders', async () => {
    const db = createMockDb([
      { match: 'SELECT version_id FROM koop_legal_text_live', rows: [{ version_id: 6 }] },
      {
        match: 'ORDER BY version_no DESC',
        rows: [versionRow(), versionRow({ id: 6, version_no: 1, body_md: 'fertig' })],
      },
    ])

    await expect(listLegalVersions(db.pool, 'datenschutz')).resolves.toStrictEqual([
      {
        id: 7,
        versionNo: 2,
        note: 'Hoster ergänzt',
        createdBy: 'betrieb',
        createdAt: T2,
        live: false,
        placeholders: 2,
      },
      {
        id: 6,
        versionNo: 1,
        note: 'Hoster ergänzt',
        createdBy: 'betrieb',
        createdAt: T2,
        live: true,
        placeholders: 0,
      },
    ])
  })

  it('marks none live when the page has no pointer yet', async () => {
    const db = createMockDb([{ match: 'ORDER BY version_no DESC', rows: [versionRow()] }])

    expect((await listLegalVersions(db.pool, 'agb'))[0].live).toBe(false)
  })
})

describe('getLegalVersion', () => {
  it('returns Markdown and HTML of a version of that page', async () => {
    const db = createMockDb([
      { match: 'SELECT version_id FROM koop_legal_text_live', rows: [{ version_id: 7 }] },
      { match: 'WHERE slug = ? AND id = ?', rows: [versionRow()] },
    ])

    await expect(getLegalVersion(db.pool, 'agb', 7)).resolves.toMatchObject({
      id: 7,
      slug: 'agb',
      live: true,
      bodyMd: versionRow().body_md,
      html: '<h2>A</h2>',
    })
    expect(db.calls[0].params).toStrictEqual(['agb', 7])
  })

  it('is null for an id of another page or no id at all', async () => {
    await expect(getLegalVersion(createMockDb().pool, 'agb', 7)).resolves.toBeNull()
  })
})

describe('createLegalVersion', () => {
  it('numbers on from the newest version and stores the rendered HTML with it', async () => {
    const db = createMockDb([{ match: 'COALESCE(MAX(version_no), 0)', rows: [{ newest: 4 }] }])
    dbInsert.mockResolvedValueOnce(99)

    const created = await createLegalVersion(
      db.pool,
      { slug: 'impressum', bodyMd: 'Dürnau', note: 'n', createdBy: 'betrieb' },
      { remoteIp: '10.0.0.1' },
    )

    expect(created).toStrictEqual({ id: 99, versionNo: 5 })
    expect(dbInsert).toHaveBeenCalledWith(
      db.pool,
      'koop_legal_text_version',
      expect.objectContaining({
        slug: 'impressum',
        version_no: 5,
        body_md: 'Dürnau',
        body_html: '<p>D&#252;rnau</p>\n',
        note: 'n',
        created_by: 'betrieb',
        created_at: expect.any(Date),
      }),
      { remoteIp: '10.0.0.1' },
    )
  })

  it('starts at 1 for a page without versions', async () => {
    const db = createMockDb([{ match: 'COALESCE', rows: [{ newest: 0 }] }])

    expect(
      (await createLegalVersion(db.pool, { slug: 'agb', bodyMd: 'x', note: '', createdBy: 'a' }))
        .versionNo,
    ).toBe(1)
  })

  it('starts at 1 even if the aggregate comes back empty', async () => {
    expect(
      (
        await createLegalVersion(createMockDb().pool, {
          slug: 'agb',
          bodyMd: 'x',
          note: '',
          createdBy: 'a',
        })
      ).versionNo,
    ).toBe(1)
  })
})

describe('activateLegalVersion', () => {
  it('moves the existing pointer and logs the activation', async () => {
    const db = createMockDb([
      { match: 'SELECT id FROM koop_legal_text_version', rows: [{ id: 8 }] },
      { match: 'SELECT version_id FROM koop_legal_text_live', rows: [{ version_id: 7 }] },
    ])

    await expect(
      activateLegalVersion(db.pool, 'agb', 8, 'betrieb', { remoteIp: 'ip' }),
    ).resolves.toBe(true)

    const pointer = { version_id: 8, activated_by: 'betrieb', activated_at: expect.any(Date) }
    expect(dbUpdate).toHaveBeenCalledWith(
      db.pool,
      'koop_legal_text_live',
      { slug: 'agb' },
      pointer,
      {
        remoteIp: 'ip',
      },
    )
    expect(dbInsert).toHaveBeenCalledTimes(1)
    expect(dbInsert).toHaveBeenCalledWith(
      db.pool,
      'koop_legal_text_activation',
      { slug: 'agb', ...pointer },
      { remoteIp: 'ip' },
    )
  })

  it('creates the pointer on the first activation of a page', async () => {
    const db = createMockDb([
      { match: 'SELECT id FROM koop_legal_text_version', rows: [{ id: 8 }] },
    ])

    await activateLegalVersion(db.pool, 'agb', 8, 'system')

    expect(dbUpdate).not.toHaveBeenCalled()
    expect(dbInsert.mock.calls.map((c: unknown[]) => c[1])).toStrictEqual([
      'koop_legal_text_live',
      'koop_legal_text_activation',
    ])
  })

  it('refuses a version that belongs to another page', async () => {
    await expect(activateLegalVersion(createMockDb().pool, 'agb', 8, 'betrieb')).resolves.toBe(
      false,
    )
    expect(dbInsert).not.toHaveBeenCalled()
    expect(dbUpdate).not.toHaveBeenCalled()
  })
})
