import { expect } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * Selector policy: form fields and buttons are addressed by their accessible
 * name (getByLabel / getByRole). That way the suite fails when a label goes
 * missing or a button loses its name — the tests double as a check that the UI
 * stays operable with a screen reader. Only anchors with no meaningful
 * accessible name of their own (a product card, the price element, the cart
 * panel) keep a data-testid.
 */

/** Matches app/scripts/seed-e2e.mjs — kept here so specs read as prose. */
export const CUSTOMER = {
  email: 'e2e@example.org',
  password: 'e2e-test-password',
  name: 'Erika Musterfrau',
}

export const ADMIN = { username: 'e2e-admin', password: 'e2e-admin-password' }

export function productCard(page: Page, name: string) {
  return page.getByTestId('product-card').filter({ hasText: name })
}

export function cart(page: Page) {
  return page.getByRole('dialog', { name: /Bestellliste|Anmelden|Versand|Übersicht|Bestellung/ })
}

/**
 * Opens the shop showing the whole range. The storefront preselects a category
 * (see filter.spec.ts), which most specs do not care about — they just need
 * their fixture product to be on screen. Pass a slug to land on a category.
 */
export async function openShop(page: Page, category = 'alle'): Promise<void> {
  await page.goto(`/shop?kategorie=${category}`)
  await expect(page.getByTestId('product-card').first()).toBeVisible()
  // The "how ordering works" dialog is opened from onMounted, so its appearance
  // is proof that the client took over — a stronger gate than any Vue internal.
  // It also covers the grid, so it has to go before anything can be clicked.
  const welcome = page.getByRole('dialog', { name: 'So funktioniert die Bestellung' })
  await welcome.waitFor({ state: 'visible' })
  await welcome.getByRole('button', { name: 'Verstanden' }).click()
  await expect(welcome).toBeHidden()
}

/**
 * Adding the first item triggers the cookie banner, because the cart may only be
 * persisted with consent. Accept it and let the queued add-to-cart run.
 */
export async function addToCart(page: Page, name: string): Promise<void> {
  await productCard(page, name).getByRole('button', { name: 'Auf die Bestellliste' }).click()
  const consent = page.getByRole('dialog', { name: 'Cookie-Hinweis' })
  if (await consent.isVisible().catch(() => false)) {
    await consent.getByRole('button', { name: 'Akzeptieren' }).click()
  }
  await expect(consent).toBeHidden()
}

/** Idempotent: adding an item already opens the sidebar (see useCart.addToCart). */
export async function openCart(page: Page): Promise<void> {
  const sidebar = page.getByTestId('cart-sidebar')
  if (!(await sidebar.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Bestellliste öffnen' }).click()
  }
  await expect(sidebar).toBeVisible()
}

export async function login(page: Page): Promise<void> {
  await page.getByLabel('E-Mail *').fill(CUSTOMER.email)
  await page.getByLabel('Passwort *').fill(CUSTOMER.password)
  // The tab of the same name is a role="tab", so this resolves to the submit.
  await page.getByRole('button', { name: 'Anmelden' }).click()
}

/**
 * Drives cart → login → shipping/payment → confirm → send, and returns once the
 * success panel is up. Everything the checkout needs is passed in, so a spec can
 * vary one dimension without repeating the whole path.
 */
export async function checkout(
  page: Page,
  opts: { shipping?: string; payment?: string; notes?: string } = {},
): Promise<void> {
  const { shipping = 'abholung', payment = 'vorkasse', notes } = opts

  await openCart(page)
  await page.getByRole('button', { name: 'Zur Bestellung' }).click()

  // The auth step is skipped when a session cookie is already present, so the
  // next screen is either the login form or already shipping/payment. Wait for
  // whichever arrives instead of probing — a bare isVisible() right after the
  // click races the step transition and silently takes the wrong branch.
  const emailField = page.getByLabel('E-Mail *')
  const shippingRadio = page.locator('input[name="shipping"]').first()
  await expect(emailField.or(shippingRadio).first()).toBeVisible()
  if (await emailField.isVisible()) await login(page)
  await expect(shippingRadio).toBeVisible()

  await page.locator(`input[name="shipping"][value="${shipping}"]`).check()
  await page.locator(`input[name="payment"][value="${payment}"]`).check()
  if (notes != null) await page.getByLabel('Anmerkungen (optional)').fill(notes)
  await page.getByRole('button', { name: 'Weiter zur Übersicht' }).click()

  await page.getByRole('button', { name: 'Bestellung absenden' }).click()
  await expect(page.getByTestId('cart-success')).toBeVisible()
}
