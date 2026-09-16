import { test, expect } from '@playwright/test'

import { expectNoNewA11yViolations } from './helpers/axe'
import { ADMIN, CUSTOMER, addToCart, openCart, openShop, productCard } from './helpers/shop'

import type { Page } from '@playwright/test'

/**
 * Automated WCAG scan of every view a visitor or the operator actually reaches.
 * The mechanics — ruleset, baseline, how to refresh it — live in
 * helpers/axe.ts; this file only decides *what* gets looked at.
 *
 * The dialogs are scanned in their open state on purpose: a modal is where the
 * hardest accessibility problems sit, and it is invisible to a scan of the page
 * behind it. The checkout is scanned step by step for the same reason — it is
 * one route, but four different screens.
 */
test.describe.configure({ mode: 'serial' })

/** Cart → checkout, stopping on the step where the login form stands. */
async function openCheckout(page: Page): Promise<void> {
  await openShop(page)
  await addToCart(page, 'Honig')
  await openCart(page)
  await page.getByRole('button', { name: 'Zur Bestellung' }).click()
  await expect(page.getByLabel('E-Mail *')).toBeVisible()
}

test.describe('storefront', () => {
  test('the front page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoNewA11yViolations(page, 'startseite')
  })

  test('the product grid', async ({ page }) => {
    await openShop(page)
    await expectNoNewA11yViolations(page, 'shop-grid')
  })

  test('a product detail page', async ({ page }) => {
    await page.goto('/shop/1/honig')
    await expect(page.getByRole('link', { name: 'Zurück zum Shop' })).toBeVisible()
    await expectNoNewA11yViolations(page, 'produktdetail')
  })

  test('the imprint', async ({ page }) => {
    await page.goto('/impressum')
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible()
    await expectNoNewA11yViolations(page, 'impressum')
  })

  test('the privacy statement', async ({ page }) => {
    await page.goto('/datenschutz')
    await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible()
    await expectNoNewA11yViolations(page, 'datenschutz')
  })
})

test.describe('dialogs', () => {
  test('the welcome overlay', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByRole('dialog', { name: 'So funktioniert die Bestellung' })).toBeVisible()
    await expectNoNewA11yViolations(page, 'dialog-willkommen')
  })

  test('the cookie notice', async ({ page }) => {
    await openShop(page)
    // The first add asks for consent; leave the question standing.
    await productCard(page, 'Honig').getByRole('button', { name: 'Auf die Bestellliste' }).click()
    await expect(page.getByRole('dialog', { name: 'Cookie-Hinweis' })).toBeVisible()
    await expectNoNewA11yViolations(page, 'dialog-cookie')
  })

  test('the cart', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await expect(page.getByTestId('cart-sidebar')).toBeVisible()
    await expectNoNewA11yViolations(page, 'warenkorb')
  })
})

test.describe('checkout', () => {
  test('the login step', async ({ page }) => {
    await openCheckout(page)
    await expectNoNewA11yViolations(page, 'checkout-anmelden')
  })

  test('the registration step', async ({ page }) => {
    await openCheckout(page)
    // The largest form in the app — eleven fields.
    await page.getByRole('tab', { name: 'Konto anlegen' }).click()
    await expect(page.getByLabel('Vorname *')).toBeVisible()
    await expectNoNewA11yViolations(page, 'checkout-registrierung')
  })

  test('the shipping and payment step', async ({ page }) => {
    await openCheckout(page)
    await page.getByLabel('E-Mail *').fill(CUSTOMER.email)
    await page.getByLabel('Passwort *').fill(CUSTOMER.password)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.locator('input[name="shipping"]').first()).toBeVisible()
    await expectNoNewA11yViolations(page, 'checkout-versand-zahlung')
  })

  test('the summary step', async ({ page }) => {
    await openCheckout(page)
    await page.getByLabel('E-Mail *').fill(CUSTOMER.email)
    await page.getByLabel('Passwort *').fill(CUSTOMER.password)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await page.locator('input[name="shipping"][value="abholung"]').check()
    await page.locator('input[name="payment"][value="vorkasse"]').check()
    await page.getByRole('button', { name: 'Weiter zur Übersicht' }).click()
    // Stops short of sending: the scan has no business writing an order.
    await expect(page.getByRole('button', { name: 'Bestellung absenden' })).toBeVisible()
    await expectNoNewA11yViolations(page, 'checkout-uebersicht')
  })
})

/**
 * The operator works in here every day, so it is held to the same bar. It is
 * client-rendered (ssr: false in nuxt.config.ts), hence the wait on real
 * content rather than on the route.
 */
test.describe('admin', () => {
  test.use({ httpCredentials: ADMIN })

  test('the dashboard', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Statistik' })).toBeVisible()
    await expectNoNewA11yViolations(page, 'admin-dashboard')
  })

  test('the order list', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.getByRole('table')).toBeVisible()
    await expectNoNewA11yViolations(page, 'admin-bestellungen')
  })
})
