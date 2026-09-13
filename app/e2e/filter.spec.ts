import { test, expect } from '@playwright/test'

import { api } from './helpers/api'
import { closeDb } from './helpers/db'
import { productCard } from './helpers/shop'

import type { Page } from '@playwright/test'

/**
 * The category filter preselects a category instead of showing everything, and
 * "Alle" sits at the end of each row as the way out of the filter.
 *
 * The seed builds the tree these tests rely on (scripts/seed-e2e.mjs):
 *   Naturkost     — Honig, Brot, plus the child Öle
 *     └ Öle       — Olivenöl
 *   Papeterie     — Karte
 * so the default resolves to Naturkost › Öle.
 */
test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await closeDb()
})

/** Dismisses the welcome dialog; that is also the hydration gate. */
async function landOn(page: Page, url: string) {
  await page.goto(url)
  const welcome = page.getByRole('dialog', { name: 'So funktioniert die Bestellung' })
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.getByRole('button', { name: 'Verstanden' }).click()
    await expect(welcome).toBeHidden()
  }
}

const shownProducts = (page: Page) => page.getByTestId('product-card').locator('h3')

test.describe('category filter', () => {
  test('preselects the first category and its first subcategory', async ({ page }) => {
    await landOn(page, '/shop')

    await expect(page.getByRole('button', { name: /^Naturkost/ })).toHaveClass(/bg-\[#00af8c\]/)
    await expect(page.getByRole('button', { name: /^Öle/ })).toHaveClass(/bg-\[#00af8c\]/)
    await expect(shownProducts(page)).toHaveText(['Olivenöl'])
  })

  test('keeps /shop free of query parameters', async ({ page }) => {
    await landOn(page, '/shop')
    // No redirect: a plain link to the shop stays a plain link.
    expect(new URL(page.url()).search).toBe('')
  })

  test('puts "Alle" last in both rows', async ({ page }) => {
    await landOn(page, '/shop')

    const topRow = page.locator('.flex.flex-wrap.gap-2').first().locator('button')
    await expect(topRow.last()).toHaveAccessibleName('Alle Kategorien')

    const subRow = page.locator('.border-l-2 button')
    await expect(subRow.last()).toHaveAccessibleName('Alle Naturkost')
  })

  test('"Alle" shows the whole range and is linkable', async ({ page }) => {
    await landOn(page, '/shop')
    await page.getByRole('button', { name: 'Alle Kategorien' }).click()

    await expect(page).toHaveURL(/\?kategorie=alle$/)
    // Every category is represented, no longer just the preselected one. The
    // list is not asserted in full because the grid paginates at 24 — that side
    // of it belongs to lazy-load.spec.ts.
    for (const name of ['Honig', 'Brot', 'Karte', 'Olivenöl']) {
      await expect(productCard(page, name)).toHaveCount(1)
    }
    // Sorted by view count, then name.
    await expect(shownProducts(page).first()).toHaveText('Honig')
  })

  test('the subcategory "Alle" falls back to the whole parent category', async ({ page }) => {
    await landOn(page, '/shop')
    await page.getByRole('button', { name: 'Alle Naturkost' }).click()

    // Honig and Brot hang directly off the parent, Olivenöl off the child.
    await expect(shownProducts(page)).toHaveText(['Honig', 'Brot', 'Olivenöl'])
  })

  test('a category without children needs no second row', async ({ page }) => {
    await landOn(page, '/shop?kategorie=papeterie')
    await expect(shownProducts(page)).toHaveText(['Karte'])
    await expect(page.locator('.border-l-2 button')).toHaveCount(0)
  })

  test('an unknown category falls back to the default instead of showing nothing', async ({
    page,
  }) => {
    await landOn(page, '/shop?kategorie=gibtesnicht')
    await expect(shownProducts(page)).toHaveText(['Olivenöl'])
  })
})

test.describe('search across the preselected category', () => {
  test('searches the whole range, not just the active category', async ({ page }) => {
    await landOn(page, '/shop')
    // "Karte" sits in Papeterie while Naturkost › Öle is active — without the
    // switch to "Alle" this would report nothing found.
    await page.getByLabel('Produkte durchsuchen').fill('Karte')

    await expect(shownProducts(page)).toHaveText(['Karte'])
    await expect(page).toHaveURL(/kategorie=alle/)
  })

  test('clearing the search returns to the default category', async ({ page }) => {
    await landOn(page, '/shop')
    const search = page.getByLabel('Produkte durchsuchen')
    await search.fill('Karte')
    await expect(shownProducts(page)).toHaveText(['Karte'])

    await search.fill('')
    await expect(shownProducts(page)).toHaveText(['Olivenöl'])
    expect(new URL(page.url()).search).toBe('')
  })

  test('clearing the search restores a category the customer had chosen', async ({ page }) => {
    await landOn(page, '/shop')
    await page.getByRole('button', { name: /^Papeterie/ }).click()
    await expect(shownProducts(page)).toHaveText(['Karte'])

    const search = page.getByLabel('Produkte durchsuchen')
    await search.fill('Honig')
    await expect(shownProducts(page)).toHaveText(['Honig'])

    await search.fill('')
    await expect(page).toHaveURL(/kategorie=papeterie/)
    await expect(shownProducts(page)).toHaveText(['Karte'])
  })

  test('narrowing to a category while searching scopes the search', async ({ page }) => {
    await landOn(page, '/shop')
    await page.getByLabel('Produkte durchsuchen').fill('o')
    // Honig, Brot and Olivenöl all contain an "o"; Karte does not.
    await expect(shownProducts(page)).toHaveText(['Honig', 'Brot', 'Olivenöl'])

    await page.getByRole('button', { name: /^Naturkost/ }).click()
    await expect(page).toHaveURL(/kategorie=naturkost/)
    await expect(shownProducts(page)).toHaveText(['Honig', 'Brot', 'Olivenöl'])
  })

  test('a category without search hits cannot be selected', async ({ page }) => {
    await landOn(page, '/shop')
    await page.getByLabel('Produkte durchsuchen').fill('o')

    // Papeterie holds no match, so the filter greys it out — the customer
    // cannot click their way into an empty result while a search is running.
    await expect(page.getByRole('button', { name: /^Papeterie/ })).toBeDisabled()
  })
})

test.describe('ordering by the shop', () => {
  test('the inactive product stays hidden in every view', async ({ page }) => {
    await landOn(page, '/shop?kategorie=alle')
    await expect(productCard(page, 'Ausgelistet')).toHaveCount(0)

    // Same context, so the welcome dialog does not reappear — landOn tolerates that.
    await landOn(page, '/shop?kategorie=naturkost')
    await expect(productCard(page, 'Ausgelistet')).toHaveCount(0)
  })
})

/**
 * The food range moved out of this shop. Its products are still active in the
 * osCommerce database (the old shop keeps selling them), so the catalog has to
 * drop them — the seed keeps "Salz" in Lebensmittel and "Zwieback" in its child
 * Gebäck as the proof.
 */
test.describe('the hidden Lebensmittel category', () => {
  test('has no filter button', async ({ page }) => {
    await landOn(page, '/shop?kategorie=alle')

    await expect(page.getByRole('button', { name: /^Lebensmittel/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Gebäck/ })).toHaveCount(0)
  })

  test('keeps its products out of every view', async ({ page }) => {
    await landOn(page, '/shop?kategorie=alle')
    for (const name of ['Salz', 'Zwieback']) {
      await expect(productCard(page, name)).toHaveCount(0)
    }

    // Not findable either — the search runs across the whole range.
    await page.getByLabel('Produkte durchsuchen').fill('Salz')
    await expect(page.getByTestId('product-card')).toHaveCount(0)
  })

  test('falls back to the default when linked directly', async ({ page }) => {
    // An old bookmark must not open an empty shop.
    await landOn(page, '/shop?kategorie=lebensmittel')
    await expect(shownProducts(page)).toHaveText(['Olivenöl'])
  })

  test('does not serve its products on the detail route', async ({ page }) => {
    await landOn(page, '/shop?kategorie=alle')

    // Guessing the URL of a hidden product gets you a 404, not the product.
    expect((await api(page, 'GET', '/api/products/salz')).status).toBe(404)
    expect((await api(page, 'GET', '/api/products/8')).status).toBe(404)
  })
})
