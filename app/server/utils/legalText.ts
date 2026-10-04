import { LEGAL_PAGES } from '../../app/data/legalPages'

import { dbInsert, dbUpdate } from './dbWrite'
import { findPlaceholders, renderLegalMarkdown } from './legalMarkdown'

import type { WriteContext } from './dbWrite'
import type { LegalSlug } from '../../app/data/legalPages'
import type { Pool, RowDataPacket } from 'mysql2/promise'

/**
 * Versioned legal texts, shared by the new and the old shop.
 *
 * Versions are immutable — editing creates a new one. Which version is live is
 * a single pointer row per page in koop_legal_text_live; every activation is
 * also appended to koop_legal_text_activation, so it stays provable which text
 * applied when. See database/migrations/005_koop_legal_text.sql.
 */

export interface LiveLegalText {
  slug: LegalSlug
  versionId: number
  versionNo: number
  html: string
  activatedAt: string
}

export interface LegalVersionSummary {
  id: number
  versionNo: number
  note: string
  createdBy: string
  createdAt: string
  live: boolean
  placeholders: number
}

export interface LegalVersion extends LegalVersionSummary {
  slug: LegalSlug
  bodyMd: string
  html: string
}

export interface LegalOverviewEntry {
  slug: LegalSlug
  title: string
  versionCount: number
  live: { versionId: number; versionNo: number; activatedBy: string; activatedAt: string } | null
  /** Newest version is not the live one — there is a draft waiting. */
  hasNewerDraft: boolean
}

const iso = (value: unknown) => new Date(value as string).toISOString()

/** The live text of a page, or null when none has been activated yet. */
export async function getLiveLegalText(db: Pool, slug: LegalSlug): Promise<LiveLegalText | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT v.id, v.version_no, v.body_html, l.activated_at
       FROM koop_legal_text_live l
       JOIN koop_legal_text_version v ON v.id = l.version_id
      WHERE l.slug = ? LIMIT 1`,
    [slug],
  )
  const row = rows[0]
  if (!row) return null
  return {
    slug,
    versionId: Number(row.id),
    versionNo: Number(row.version_no),
    html: String(row.body_html),
    activatedAt: iso(row.activated_at),
  }
}

/** One row per page for the admin overview, in menu order. */
export async function listLegalOverview(db: Pool): Promise<LegalOverviewEntry[]> {
  const [counts] = await db.execute<RowDataPacket[]>(
    'SELECT slug, COUNT(*) AS n, MAX(version_no) AS newest FROM koop_legal_text_version GROUP BY slug',
  )
  const [live] = await db.execute<RowDataPacket[]>(
    `SELECT l.slug, l.version_id, v.version_no, l.activated_by, l.activated_at
       FROM koop_legal_text_live l
       JOIN koop_legal_text_version v ON v.id = l.version_id`,
  )
  return LEGAL_PAGES.map((page) => {
    const c = counts.find((r) => r.slug === page.slug)
    const l = live.find((r) => r.slug === page.slug)
    return {
      slug: page.slug,
      title: page.title,
      versionCount: c ? Number(c.n) : 0,
      live: l
        ? {
            versionId: Number(l.version_id),
            versionNo: Number(l.version_no),
            activatedBy: String(l.activated_by),
            activatedAt: iso(l.activated_at),
          }
        : null,
      hasNewerDraft: !!c && (!l || Number(c.newest) > Number(l.version_no)),
    }
  })
}

function summary(row: RowDataPacket, liveId: number | null): LegalVersionSummary {
  return {
    id: Number(row.id),
    versionNo: Number(row.version_no),
    note: String(row.note),
    createdBy: String(row.created_by),
    createdAt: iso(row.created_at),
    live: Number(row.id) === liveId,
    placeholders: findPlaceholders(String(row.body_md)).length,
  }
}

async function liveVersionId(db: Pool, slug: LegalSlug): Promise<number | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT version_id FROM koop_legal_text_live WHERE slug = ? LIMIT 1',
    [slug],
  )
  return rows[0] ? Number(rows[0].version_id) : null
}

/** All versions of a page, newest first. */
export async function listLegalVersions(db: Pool, slug: LegalSlug): Promise<LegalVersionSummary[]> {
  const liveId = await liveVersionId(db, slug)
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, version_no, note, created_by, created_at, body_md
       FROM koop_legal_text_version WHERE slug = ? ORDER BY version_no DESC`,
    [slug],
  )
  return rows.map((r) => summary(r, liveId))
}

export async function getLegalVersion(
  db: Pool,
  slug: LegalSlug,
  id: number,
): Promise<LegalVersion | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, version_no, note, created_by, created_at, body_md, body_html
       FROM koop_legal_text_version WHERE slug = ? AND id = ? LIMIT 1`,
    [slug, id],
  )
  const row = rows[0]
  if (!row) return null
  const liveId = await liveVersionId(db, slug)
  return {
    ...summary(row, liveId),
    slug,
    bodyMd: String(row.body_md),
    html: String(row.body_html),
  }
}

/** Stores a new version (never live on creation). Returns its id and number. */
export async function createLegalVersion(
  db: Pool,
  input: { slug: LegalSlug; bodyMd: string; note: string; createdBy: string },
  ctx: WriteContext = {},
): Promise<{ id: number; versionNo: number }> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT COALESCE(MAX(version_no), 0) AS newest FROM koop_legal_text_version WHERE slug = ?',
    [input.slug],
  )
  // A concurrent save would pick the same number; the unique key on
  // (slug, version_no) then rejects the second insert instead of numbering twice.
  const versionNo = Number(rows[0]?.newest ?? 0) + 1
  const id = await dbInsert(
    db,
    'koop_legal_text_version',
    {
      slug: input.slug,
      version_no: versionNo,
      body_md: input.bodyMd,
      body_html: renderLegalMarkdown(input.bodyMd),
      note: input.note,
      created_by: input.createdBy,
      created_at: new Date(),
    },
    ctx,
  )
  return { id, versionNo }
}

/** Makes a version the live one. Returns false if it does not belong to the page. */
export async function activateLegalVersion(
  db: Pool,
  slug: LegalSlug,
  versionId: number,
  activatedBy: string,
  ctx: WriteContext = {},
): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT id FROM koop_legal_text_version WHERE slug = ? AND id = ? LIMIT 1',
    [slug, versionId],
  )
  if (!rows[0]) return false

  const pointer = { version_id: versionId, activated_by: activatedBy, activated_at: new Date() }
  // Asked explicitly rather than inferred from the UPDATE's affected rows: an
  // UPDATE that changes nothing (same version, same second) also reports 0.
  if ((await liveVersionId(db, slug)) === null) {
    await dbInsert(db, 'koop_legal_text_live', { slug, ...pointer }, ctx)
  } else {
    await dbUpdate(db, 'koop_legal_text_live', { slug }, pointer, ctx)
  }
  await dbInsert(db, 'koop_legal_text_activation', { slug, ...pointer }, ctx)
  return true
}
