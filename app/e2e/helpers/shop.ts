import { expect } from '@playwright/test'

import type { Page } from '@playwright/test'

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

/**
 * Pages are server-rendered, so elements are visible long before Vue has taken
 * over. Interacting in that window silently does nothing — no listener is
 * attached yet, and the test then fails on a confusingly unchanged value.
 *
 * Only `__vue_app__` is usable as a marker: Vue strips `app._instance` from
 * production builds (it lives behind __FEATURE_PROD_DEVTOOLS__), and the suite
 * deliberately runs against the production artifact.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => !!document.getElementById('__nuxt')?.__vue_app__)
}

export async function openShop(page: Page): Promise<void> {
  await page.goto('/shop')
  await expect(page.getByTestId('product-card').first()).toBeVisible()
  // The "how ordering works" modal is opened from onMounted, so its appearance
  // is proof that the client took over — a stronger gate than any Vue internal.
  // It also covers the grid, so it has to go before anything can be clicked.
  const welcome = page.getByTestId('welcome-dismiss')
  await welcome.waitFor({ state: 'visible' })
  await welcome.click()
  await expect(welcome).toBeHidden()
}

/**
 * Adding the first item triggers the cookie banner, because the cart may only be
 * persisted with consent. Accept it and let the queued add-to-cart run.
 */
export async function addToCart(page: Page, name: string): Promise<void> {
  await productCard(page, name).getByTestId('product-add').click()
  const accept = page.getByTestId('consent-accept')
  if (await accept.isVisible().catch(() => false)) await accept.click()
  await expect(accept).toBeHidden()
}

/** Idempotent: adding an item already opens the sidebar (see useCart.addToCart). */
export async function openCart(page: Page): Promise<void> {
  const sidebar = page.getByTestId('cart-sidebar')
  if (!(await sidebar.isVisible().catch(() => false))) {
    await page.getByTestId('cart-button').click()
  }
  await expect(sidebar).toBeVisible()
}

export async function login(page: Page): Promise<void> {
  await page.getByTestId('login-email').fill(CUSTOMER.email)
  await page.getByTestId('login-password').fill(CUSTOMER.password)
  await page.getByTestId('login-submit').click()
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
  await page.getByTestId('cart-proceed').click()

  // The auth step is skipped when a session cookie is already present, so the
  // next screen is either the login form or already shipping/payment. Wait for
  // whichever arrives instead of probing — a bare isVisible() right after the
  // click races the step transition and silently takes the wrong branch.
  const emailField = page.getByTestId('login-email')
  const shippingRadio = page.locator('input[name="shipping"]').first()
  await expect(emailField.or(shippingRadio).first()).toBeVisible()
  if (await emailField.isVisible()) await login(page)
  await expect(shippingRadio).toBeVisible()

  await page.locator(`input[name="shipping"][value="${shipping}"]`).check()
  await page.locator(`input[name="payment"][value="${payment}"]`).check()
  if (notes != null) await page.getByTestId('details-notes').fill(notes)
  await page.getByTestId('details-next').click()

  await page.getByTestId('order-send').click()
  await expect(page.getByTestId('cart-success')).toBeVisible()
}
