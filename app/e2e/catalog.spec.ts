import { test, expect } from '@playwright/test'

import { openShop, productCard } from './helpers/shop'

/**
 * The storefront against the real catalog query. The seed (scripts/seed-e2e.mjs)
 * contains one product per conversion case, so these assertions pin the whole
 * DB → converter → page chain, including the gross prices the customer sees.
 */
test.describe('catalog', () => {
  test.beforeEach(async ({ page }) => {
    await openShop(page)
  })

  test('shows the active products and hides the inactive one', async ({ page }) => {
    await expect(productCard(page, 'Honig')).toBeVisible()
    await expect(productCard(page, 'Brot')).toBeVisible()
    await expect(productCard(page, 'Olivenöl')).toBeVisible()
    await expect(productCard(page, 'Karte')).toBeVisible()
    // products_status = 0 — must never reach the shop.
    await expect(productCard(page, 'Ausgelistet')).toHaveCount(0)
  })

  test('applies the full VAT rate to a normal product', async ({ page }) => {
    // 10.00 net at tax class 2 (19 %) = 11.90 gross
    await expect(productCard(page, 'Honig').getByTestId('product-price')).toHaveText(/11,?\.?90/)
  })

  test('applies the reduced VAT rate where the tax class says so', async ({ page }) => {
    // 3.00 net at tax class 3 (7 %) = 3.21 gross
    await expect(productCard(page, 'Brot').getByTestId('product-price')).toHaveText(/3,?\.?21/)
  })

  test('merges size variants into a single product with a size picker', async ({ page }) => {
    const card = productCard(page, 'Olivenöl')
    await expect(card).toHaveCount(1)
    const options = card.getByLabel(/Gebindegröße/).locator('option')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toContainText('0,5 L')
    await expect(options.nth(1)).toContainText('1 L')
  })

  test('prices the selected size variant', async ({ page }) => {
    const card = productCard(page, 'Olivenöl')
    // 8.00 net → 9.52 gross; 15.00 net → 17.85 gross
    await expect(card.getByTestId('product-price')).toHaveText(/9,?\.?52/)
    await card.getByLabel(/Gebindegröße/).selectOption({ index: 1 })
    await expect(card.getByTestId('product-price')).toHaveText(/17,?\.?85/)
  })

  test('switches a quantity-tier product to the cheaper tier', async ({ page }) => {
    const card = productCard(page, 'Karte')
    // 1 piece at 2.00 net → 2.38 gross
    await expect(card.getByTestId('product-price')).toHaveText(/2,?\.?38/)
    // From 10 pieces the 1.50 net tier applies → 1.79 gross each, 17.90 total
    await card.getByLabel('Anz.').fill('10')
    await expect(card.getByTestId('product-price')).toHaveText(/17,?\.?90/)
  })

  test('builds nested category slugs from the category tree', async ({ page }) => {
    await page.goto('/shop/3/olivenoel')
    await expect(page.getByRole('heading', { name: 'Olivenöl' })).toBeVisible()
  })
})
