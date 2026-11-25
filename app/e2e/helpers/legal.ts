import { ADMIN } from './shop'

import type { LegalSlug } from '../../app/data/legalPages'

interface FixtureVersion {
  note: string
  bodyMd: string
  live?: boolean
}

/** A placeholder page: one heading, one sentence. */
function page(slug: string): string {
  return `## Abschnitt ${slug}\n\nFiktiver Text für ${slug}.\n`
}

/**
 * Fictitious legal texts (Musterfirma, example.org) — the real ones are not part
 * of this repository. One live version per page; the Impressum also has a draft
 * with an open placeholder, for the admin specs.
 */
export const LEGAL_FIXTURES: Record<LegalSlug, FixtureVersion[]> = {
  agb: [{ note: 'E2E Ausgangstext', live: true, bodyMd: page('agb') }],
  datenschutz: [{ note: 'E2E Ausgangstext', live: true, bodyMd: page('datenschutz') }],
  impressum: [
    {
      note: 'E2E Ausgangstext',
      live: true,
      bodyMd:
        '## Angaben gemäß § 5 DDG\n\nMusterfirma GmbH\nMusterweg 1\n12345 Musterstadt\n\n' +
        'E-Mail: [info@example.org](mailto:info@example.org)\n',
    },
    {
      note: 'E2E Entwurf',
      bodyMd: '## Angaben gemäß § 5 DDG\n\nMusterfirma GmbH\nRegisternummer: [[HRB fehlt]]\n',
    },
  ],
  versand: [{ note: 'E2E Ausgangstext', live: true, bodyMd: page('versand') }],
  widerruf: [{ note: 'E2E Ausgangstext', live: true, bodyMd: page('widerruf') }],
}

/** What a call did, per page: `versions` created, or skipped because it had some. */
export type ImportResult = Record<LegalSlug, { created: number } | 'skipped'>

/**
 * Creates the fixture texts through the admin API, exactly as an edit in the
 * admin would (rendered and audited by the server, saved under the admin's
 * name), and puts the marked versions live.
 *
 * Idempotent: a page that already has a version is left alone, so any spec that
 * needs live texts can call it without depending on the order the specs run in.
 */
export async function importLegalFixtures(baseURL: string): Promise<ImportResult> {
  const authorization = `Basic ${Buffer.from(`${ADMIN.username}:${ADMIN.password}`).toString('base64')}`

  async function api<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(new URL(path, baseURL), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${await res.text()}`)
    return (await res.json()) as T
  }

  const overview = await api<{ slug: LegalSlug; versionCount: number }[]>('/admin/api/legal')
  const result = {} as ImportResult
  for (const { slug, versionCount } of overview) {
    if (versionCount > 0) {
      result[slug] = 'skipped'
      continue
    }
    for (const version of LEGAL_FIXTURES[slug]) {
      const created = await api<{ id: number }>(`/admin/api/legal/${slug}/versions`, {
        bodyMd: version.bodyMd,
        note: version.note,
      })
      if (version.live) await api(`/admin/api/legal/${slug}/versions/${created.id}/activate`, {})
    }
    result[slug] = { created: LEGAL_FIXTURES[slug].length }
  }
  return result
}
