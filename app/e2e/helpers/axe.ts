import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'
import type { Result } from 'axe-core'

/**
 * Automated WCAG scan with a ratcheting baseline.
 *
 * Why alongside a11y.spec.ts and not instead of it: the two find disjoint
 * things. axe cannot press Escape, cannot tell where focus went and cannot
 * measure a touch target — that is what the handwritten suite is for. The
 * handwritten suite in turn only checks what somebody thought of; axe adds
 * contrast ratios, invalid ARIA, landmark and heading structure, duplicate ids.
 *
 * Why a baseline instead of demanding zero: the state of the storefront is what
 * it is, and blocking every change on a colour decision would mean the check
 * never lands. The baseline records the violations that exist today; a rule that
 * is not in it fails the build. It is a floor that only moves down — fixing a
 * rule makes the test fail too, asking for the entry to be dropped, exactly like
 * the coverage ratchet in vitest.config.ts.
 *
 * Why the baseline keys on rule ids and not on individual nodes: axe reports one
 * node per offending element, so a contrast problem on the product card shows up
 * once per card — and the count then moves with the seed fixtures rather than
 * with the code. Rule ids are stable against both. The full node list (selectors
 * and HTML) is attached to the Playwright report, so fixing still has addresses
 * to work from.
 *
 * Refresh after an intended change:
 *   npm run test:e2e:a11y:update
 */

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'a11y-baseline.json')

/**
 * WCAG 2.0/2.1/2.2 level A and AA — the normative set, and the bar the BFSG
 * applies to online retail. `best-practice` is deliberately left out: those
 * rules are advice, not conformance, and would fill the baseline with noise.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const UPDATING = !!process.env.A11Y_UPDATE_BASELINE

type Baseline = Record<string, string[]>

async function readBaseline(): Promise<Baseline> {
  try {
    return JSON.parse(await readFile(BASELINE_PATH, 'utf8')) as Baseline
  } catch {
    // Absent on the very first run; A11Y_UPDATE_BASELINE=1 creates it.
    return {}
  }
}

/**
 * Rewrites one view's entry and leaves the rest alone — the suite runs with a
 * single worker (playwright.config.ts), so read-modify-write is safe here. A
 * view that came out clean drops out of the file entirely.
 */
async function writeBaseline(view: string, rules: string[]): Promise<void> {
  const entries = Object.entries(await readBaseline()).filter(([key]) => key !== view)
  if (rules.length) entries.push([view, rules])
  entries.sort(([a], [b]) => a.localeCompare(b))
  await writeFile(BASELINE_PATH, `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`)
}

/** Human-readable detail for the report: what failed, where, and how to fix it. */
function describeViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `      - ${n.target.join(' ')}`).join('\n')
      return `  ${v.id} (${v.impact ?? 'n/a'}, ${v.nodes.length}×)\n    ${v.help}\n    ${v.helpUrl}\n${nodes}`
    })
    .join('\n\n')
}

/**
 * Scans whatever is currently on screen and compares the set of failing rules
 * against the baseline entry for `view`.
 */
export async function expectNoNewA11yViolations(page: Page, view: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const found = [...new Set(results.violations.map((v) => v.id))].sort()

  // The detail never gates anything, but it is what makes a failure fixable.
  await test
    .info()
    .attach(`axe-${view}.json`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    })
    .catch(() => {})

  if (UPDATING) {
    await writeBaseline(view, found)
    // eslint-disable-next-line no-console
    console.log(`[a11y] ${view}: ${found.length ? found.join(', ') : 'clean'}`)
    return
  }

  const accepted = (await readBaseline())[view] ?? []
  const regressions = found.filter((id) => !accepted.includes(id))
  const resolved = accepted.filter((id) => !found.includes(id))

  expect(
    regressions,
    `New accessibility violations on "${view}":\n\n${describeViolations(
      results.violations.filter((v) => regressions.includes(v.id)),
    )}\n\nFix them, or — with a reason — accept them via npm run test:e2e:a11y:update.`,
  ).toEqual([])

  // The floor only moves down: a rule that no longer fires has to leave the
  // baseline, otherwise it would silently cover a later regression again.
  expect(
    resolved,
    `Fixed on "${view}" — drop from e2e/a11y-baseline.json via npm run test:e2e:a11y:update.`,
  ).toEqual([])
}
