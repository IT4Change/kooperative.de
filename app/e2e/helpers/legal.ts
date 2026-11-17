import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { ADMIN } from './shop'

const run = promisify(execFile)

/**
 * Imports the fictitious legal texts in e2e/fixtures/legal through the admin
 * API, as on a real server. Idempotent: pages that already have a version are
 * skipped, so any spec that needs live texts can call it without depending on
 * the order the specs run in.
 */
export async function importLegalFixtures(baseURL: string): Promise<string> {
  const { stdout } = await run(
    'node',
    ['scripts/legal-import.mjs', 'e2e/fixtures/legal', '--url', baseURL],
    { env: { ...process.env, LEGAL_IMPORT_AUTH: `${ADMIN.username}:${ADMIN.password}` } },
  )
  return stdout
}
