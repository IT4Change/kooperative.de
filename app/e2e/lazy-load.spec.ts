import { test, expect } from '@playwright/test'

import { closeDb } from './helpers/db'
import { openShop } from './helpers/shop'

import type { Page } from '@playwright/test'

/**
 * The grid shows 24 products and reveals the rest as the customer scrolls. The
 * seed carries 30 "Zubehör" fillers on top of the hand-written fixtures so there
 * is a second page at all (see scripts/seed-e2e.mjs).
 *
 * Nothing is fetched here — the whole catalog is already in the page and only
 * sliced, so "loaded" means "rendered" and no request has to be waited for.
 */
test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await closeDb()
})

const PAGE_SIZE = 24
const cards = (page: Page) => page.getByTestId('product-card')
const loadMore = (page: Page) => page.getByRole('button', { name: 'Mehr anzeigen' })

test.describe('lazy loading', () => {
  test('starts with one page and offers the button', async ({ page }) => {
    await openShop(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(loadMore(page)).toBeVisible()
  })

  test('loads the next page when the customer scrolls down', async ({ page }) => {
    await openShop(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    await page.mouse.wheel(0, 20_000)

    // More than the first page, without anything having been clicked.
    await expect(cards(page)).toHaveCount(34)
  })

  test('hides the button once everything is shown', async ({ page }) => {
    await openShop(page)
    await page.mouse.wheel(0, 20_000)
    await expect(cards(page)).toHaveCount(34)
    await expect(loadMore(page)).toBeHidden()
  })

  test('the button still works on its own', async ({ page }) => {
    await openShop(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    // Clicking without scrolling must reveal the rest just the same — this is
    // the path for keyboard users and for a browser without IntersectionObserver.
    await loadMore(page).click()
    await expect(cards(page)).toHaveCount(34)
  })

  test('announces the new count for screen readers', async ({ page }) => {
    await openShop(page)
    const status = page.getByRole('status')
    await expect(status).toHaveText(`${PAGE_SIZE} von 34 Produkten angezeigt`)

    await page.mouse.wheel(0, 20_000)
    await expect(status).toHaveText('34 von 34 Produkten angezeigt')
  })

  test('does not auto-load past the end', async ({ page }) => {
    await openShop(page)
    await page.mouse.wheel(0, 20_000)
    await expect(cards(page)).toHaveCount(34)

    // Keep scrolling at the bottom: the observer must not keep firing.
    await page.mouse.wheel(0, 20_000)
    await page.waitForTimeout(500)
    await expect(cards(page)).toHaveCount(34)
  })

  test('a filtered view that fits on one page shows no button', async ({ page }) => {
    await openShop(page, 'papeterie')
    await expect(cards(page)).toHaveCount(1)
    await expect(loadMore(page)).toHaveCount(0)
  })

  test('narrowing the view resets back to the first page', async ({ page }) => {
    await openShop(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    // 30 matches, but the customer is still at the top: one page plus button.
    await page.getByLabel('Produkte durchsuchen').fill('Zubehör')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(loadMore(page)).toBeVisible()
  })

  test('keeps filling while the customer stays at the bottom', async ({ page }) => {
    await openShop(page)
    await page.mouse.wheel(0, 20_000)
    await expect(cards(page)).toHaveCount(34)

    // Narrowing resets the page size, but the viewport has not moved — the
    // sentinel is still in view, so the shorter result fills up again by itself
    // instead of stranding the customer in front of a "Mehr anzeigen" button
    // they are already scrolled past.
    await page.getByLabel('Produkte durchsuchen').fill('Zubehör')
    await expect(cards(page)).toHaveCount(30)
    await expect(loadMore(page)).toBeHidden()
  })
})
