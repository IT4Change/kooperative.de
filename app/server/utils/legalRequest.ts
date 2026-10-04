import { isLegalSlug } from '../../app/data/legalPages'

import type { LegalSlug } from '../../app/data/legalPages'
import type { H3Event } from 'h3'

/** Generous for a legal text (the longest proposal is ~15 kB), tiny for MEDIUMTEXT. */
export const MAX_MARKDOWN_LENGTH = 200_000

/** The `bodyMd` of a request body, validated. */
export function readLegalMarkdown(body: unknown): string {
  const bodyMd = (body as { bodyMd?: unknown } | null)?.bodyMd
  if (typeof bodyMd !== 'string' || !bodyMd.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Text fehlt' })
  }
  if (bodyMd.length > MAX_MARKDOWN_LENGTH) {
    throw createError({ statusCode: 413, statusMessage: 'Text ist zu lang' })
  }
  return bodyMd
}

/** The `slug` route parameter, validated. */
export function legalSlugParam(event: H3Event): LegalSlug {
  const slug = getRouterParam(event, 'slug')
  if (!isLegalSlug(slug)) throw createError({ statusCode: 404, statusMessage: 'Unbekannte Seite' })
  return slug
}

/** The `id` route parameter, validated. */
export function versionIdParam(event: H3Event): number {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Versions-ID' })
  }
  return id
}
