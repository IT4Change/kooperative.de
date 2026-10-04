import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { test, expect } from '@playwright/test'

import { query, closeDb } from './helpers/db'
import { ADMIN } from './helpers/shop'

import type { RowDataPacket } from 'mysql2/promise'

/**
 * Legal texts end to end: imported with the script, shown on their own pages
 * and in the legal dialog, edited and put live in the admin. The texts are
 * fictitious fixtures — the real ones are not in this repository.
 *
 * Serial: the steps build on each other (nothing → import → edit → live).
 */
test.describe.configure({ mode: 'serial' })

const run = promisify(execFile)

test.afterAll(async () => {
  await closeDb()
})

async function importFixtures(baseURL: string) {
  const { stdout } = await run(
    'node',
    ['scripts/legal-import.mjs', 'e2e/fixtures/legal', '--url', baseURL],
    { env: { ...process.env, LEGAL_IMPORT_AUTH: `${ADMIN.username}:${ADMIN.password}` } },
  )
  return stdout
}

interface VersionRow extends RowDataPacket {
  slug: string
  version_no: number
  note: string
  created_by: string
  live: number
}

const versions = async () =>
  query<VersionRow>(
    `SELECT v.slug, v.version_no, v.note, v.created_by, (l.version_id = v.id) AS live
       FROM koop_legal_text_version v
       LEFT JOIN koop_legal_text_live l ON l.slug = v.slug
      ORDER BY v.slug, v.version_no`,
  )

test('says the text is unavailable before any has been imported', async ({ page }) => {
  await page.goto('/impressum')

  await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible()
  await expect(page.getByTestId('legal-unavailable')).toBeVisible()
})

test('imports the texts with the script, and only once', async ({ baseURL }) => {
  const first = await importFixtures(baseURL!)

  expect(first).toContain('impressum/v1.md (live) → v1')
  expect(first).toContain('impressum/v2.md → v2, 1 placeholder(s)')
  const rows = await versions()
  expect(rows).toHaveLength(6)
  expect(rows.filter((r) => r.live).map((r) => `${r.slug} v${r.version_no}`)).toStrictEqual([
    'agb v1',
    'datenschutz v1',
    'impressum v1',
    'versand v1',
    'widerruf v1',
  ])
  // Saved through the admin API, so in the name of the importing user.
  expect(new Set(rows.map((r) => r.created_by))).toStrictEqual(new Set([ADMIN.username]))

  const second = await importFixtures(baseURL!)

  expect(second).toContain('impressum: has 2 version(s) already — skipped')
  expect(await versions()).toHaveLength(6)
})

test('shows the live text on its own page', async ({ page }) => {
  await page.goto('/impressum')

  const content = page.getByTestId('legal-content')
  await expect(content.getByRole('heading', { name: 'Angaben gemäß § 5 DDG' })).toBeVisible()
  await expect(content).toContainText('Musterweg 1')
  // The draft (v2) is not live.
  await expect(content).not.toContainText('HRB fehlt')
})

test('opens the legal dialog in place, with a tab per page', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('contentinfo').getByRole('link', { name: 'Widerruf' }).click()

  const dialog = page.getByRole('dialog', { name: 'Rechtliches' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL('/')
  await expect(dialog.getByRole('tab', { name: 'Widerruf' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(dialog.getByTestId('legal-content')).toContainText('Fiktiver Text für widerruf.')

  // Keyboard: the selected tab holds focus and the arrow keys move between pages.
  await dialog.getByRole('tab', { name: 'Widerruf' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('tab', { name: 'Versand & Zahlung' })).toBeFocused()
  await expect(dialog.getByTestId('legal-content')).toContainText('Fiktiver Text für versand.')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('opens the dialog from the header as well', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('banner').getByRole('link', { name: 'Rechtliches' }).click()

  const dialog = page.getByRole('dialog', { name: 'Rechtliches' })
  await expect(dialog.getByRole('tab', { name: 'Impressum' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test.describe('admin', () => {
  test.use({ httpCredentials: { username: ADMIN.username, password: ADMIN.password } })

  test('lists every page with its live version', async ({ page }) => {
    await page.goto('/admin/legal')

    const impressum = page.getByRole('row').filter({ hasText: 'Impressum' })
    await expect(impressum).toContainText('v1')
    await expect(impressum).toContainText('Entwurf')
  })

  test('saves an edit as a new version and puts it live after confirming', async ({ page }) => {
    await page.goto('/admin/legal/impressum')
    const editor = page.getByRole('textbox', { name: 'Text (Markdown)' })
    // The newest version (the draft) opens in the editor.
    await expect(editor).toHaveValue(/HRB fehlt/)

    await editor.fill('## Angaben\n\nMusterfirma GmbH\nRegisternummer: [[HRB fehlt]]\nNeu im E2E')
    await expect(page.getByTestId('md-preview')).toContainText('Neu im E2E')
    await expect(page.getByTestId('open-placeholders')).toContainText('HRB fehlt')
    await page.getByRole('textbox', { name: /Notiz/ }).fill('E2E-Änderung')
    await page.getByTestId('save').click()

    await expect(page.getByRole('status')).toHaveText(
      'Version v3 gespeichert. Sie ist noch nicht live.',
    )
    const v3 = page.getByTestId('versions').getByRole('listitem').filter({ hasText: 'v3' })
    await v3.getByRole('button', { name: 'Live schalten' }).click()

    // An open placeholder needs the extra tick before the button unlocks.
    const yes = page.getByTestId('activate-yes')
    await expect(yes).toBeDisabled()
    await page.getByLabel('Trotzdem mit offenen Platzhaltern live schalten').check()
    await yes.click()
    await expect(page.getByRole('status')).toHaveText(
      'Version v3 ist jetzt live – im neuen Shop und im Altshop.',
    )

    const rows = (await versions()).filter((r) => r.slug === 'impressum')
    expect(rows.map((r) => [r.version_no, r.note, r.created_by, !!r.live])).toStrictEqual([
      [1, 'E2E Ausgangstext', ADMIN.username, false],
      [2, 'E2E Entwurf', ADMIN.username, false],
      [3, 'E2E-Änderung', ADMIN.username, true],
    ])
    const [{ n }] = await query<RowDataPacket & { n: number }>(
      "SELECT COUNT(*) AS n FROM koop_legal_text_activation WHERE slug = 'impressum'",
    )
    expect(n).toBe(2)
  })

  test('the shop shows the new version, open placeholder marked', async ({ page }) => {
    await page.goto('/impressum')

    const content = page.getByTestId('legal-content')
    await expect(content).toContainText('Neu im E2E')
    await expect(content.locator('mark.legal-placeholder')).toHaveText('[[HRB fehlt]]')
  })
})
