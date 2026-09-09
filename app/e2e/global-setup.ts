import { execFileSync } from 'node:child_process'

/**
 * Rebuilds the E2E database from scratch before the suite starts, so a run never
 * inherits rows from the previous one. Playwright loads .env.e2e in
 * playwright.config.ts, so the seed script targets the throwaway stack.
 *
 * Synchronous on purpose: global setup must be finished before the first worker
 * starts, and there is no event loop to keep responsive here.
 */

export default function globalSetup(): void {
  // eslint-disable-next-line n/no-sync
  execFileSync('node', ['scripts/seed-e2e.mjs'], { stdio: 'inherit' })
}
