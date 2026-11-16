/**
 * Imports legal texts (Impressum, Datenschutz, AGB, …) into a running shop.
 *
 * The texts are not part of this repository. They live in a local directory —
 * by convention legal/ at the repository root, which .gitignore keeps out — and
 * this script hands them to the shop through its admin API, so they take the
 * same path as an edit in the admin: rendered and audited by the server, saved
 * under the importing user's name.
 *
 * Layout of the directory, one sub-directory per page, one file per version:
 *
 *   legal/impressum/v1.md
 *   legal/impressum/v2.md
 *   legal/datenschutz/v1.md
 *   …
 *
 * Each file is Markdown with an optional front matter block:
 *
 *   ---
 *   note: Bisheriger Text
 *   live: true
 *   ---
 *   ## Angaben …
 *
 * Files are imported in natural order (v2 before v10); at most one file per page
 * may say `live: true`, and that version is put live after the import.
 *
 * Only pages WITHOUT any version are imported — a page that has been edited in
 * the admin is never touched, so running the script twice is harmless.
 *
 * Usage (from app/):
 *   LEGAL_IMPORT_AUTH=user:password node scripts/legal-import.mjs ../legal --url https://… [--dry-run]
 *
 * The credentials come from the environment, not the command line, so they do
 * not end up in the shell history. The user is an admin user (ADMIN_USERS).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const urlIndex = args.indexOf('--url')
const baseUrl = (urlIndex === -1 ? 'http://localhost:3000' : (args[urlIndex + 1] ?? '')).replace(
  /\/$/,
  '',
)
const dir = args.find((a, i) => !a.startsWith('--') && (urlIndex === -1 || i !== urlIndex + 1))
const auth = process.env.LEGAL_IMPORT_AUTH

function fail(message) {
  console.error(`[legal-import] ${message}`)
  process.exit(1)
}

if (!dir || !baseUrl) {
  fail('usage: LEGAL_IMPORT_AUTH=user:password legal-import.mjs <dir> [--url <base>] [--dry-run]')
}
if (!auth?.includes(':')) fail('LEGAL_IMPORT_AUTH=user:password is not set')

const headers = {
  authorization: `Basic ${Buffer.from(auth).toString('base64')}`,
  'content-type': 'application/json',
}

async function api(path, body) {
  let res
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    fail(`${baseUrl} not reachable: ${err.cause?.code ?? err.message}`)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    fail(
      `${body === undefined ? 'GET' : 'POST'} ${path} → HTTP ${res.status} ${detail.slice(0, 200)}`,
    )
  }
  return res.json()
}

/** Splits an optional `---` front matter block off a Markdown file. */
function parse(file) {
  const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const meta = { note: '', live: false }
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { meta, body: raw }
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^\s*(note|live)\s*:\s*(.*?)\s*$/)
    if (!m) continue
    if (m[1] === 'note') meta.note = m[2]
    else meta.live = m[2] === 'true'
  }
  return { meta, body: raw.slice(match[0].length) }
}

const natural = new Intl.Collator('de', { numeric: true }).compare

// --- plan: read and validate everything before writing anything -------------------

const overview = await api('/admin/api/legal')
const known = new Map(overview.map((page) => [page.slug, page]))

const plan = []
for (const slug of readdirSync(dir).sort(natural)) {
  if (!statSync(join(dir, slug)).isDirectory()) continue
  const page = known.get(slug)
  if (!page) fail(`unknown page "${slug}" (known: ${[...known.keys()].join(', ')})`)
  const files = readdirSync(join(dir, slug))
    .filter((f) => f.endsWith('.md'))
    .sort(natural)
  const versions = files.map((f) => ({ file: f, ...parse(join(dir, slug, f)) }))
  if (versions.some((v) => !v.body.trim())) fail(`${slug}: empty file`)
  if (versions.filter((v) => v.meta.live).length > 1) fail(`${slug}: more than one file is live`)
  plan.push({ slug, page, versions })
}

// --- import ------------------------------------------------------------------------

let imported = 0
for (const { slug, page, versions } of plan) {
  if (page.versionCount > 0) {
    console.log(`[legal-import] ${slug}: has ${page.versionCount} version(s) already — skipped`)
    continue
  }
  if (versions.length === 0) {
    console.log(`[legal-import] ${slug}: no files — skipped`)
    continue
  }
  for (const v of versions) {
    const what = `${slug}/${v.file}${v.meta.live ? ' (live)' : ''}`
    if (dryRun) {
      console.log(`[legal-import] would import ${what}`)
      continue
    }
    const created = await api(`/admin/api/legal/${slug}/versions`, {
      bodyMd: v.body,
      note: v.meta.note,
    })
    if (v.meta.live) await api(`/admin/api/legal/${slug}/versions/${created.id}/activate`, {})
    const open = created.placeholders.length
      ? `, ${created.placeholders.length} placeholder(s)`
      : ''
    console.log(`[legal-import] ${what} → v${created.versionNo}${open}`)
    imported++
  }
}
console.log(`[legal-import] done (${dryRun ? 'dry run' : `${imported} version(s) imported`}).`)
