import { test, expect } from '@playwright/test'

import { closeDb } from './helpers/db'
import { addToCart, openCart, openShop, productCard } from './helpers/shop'

import type { Page } from '@playwright/test'

/**
 * Guards the accessibility work: labelled form controls and real dialog
 * semantics. Without these the coupling can silently rot — the rest of the
 * suite would keep passing on getByLabel for a while, because Playwright also
 * accepts a wrapping label, and it says nothing about focus or Escape at all.
 */
test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await closeDb()
})

/**
 * Every visible form control that a screen reader would announce as unnamed.
 * Mirrors the accessible-name computation for the cases this app uses:
 * label[for], wrapping label, aria-label, aria-labelledby, title.
 */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.getAttribute('type') ? `[type=${el.getAttribute('type')}]` : ''}` +
      (el.getAttribute('name') ? `[name=${el.getAttribute('name')}]` : '') +
      (el.id ? `#${el.id}` : '')

    const named = (el: HTMLElement): boolean => {
      if (el.getAttribute('aria-label')?.trim()) return true
      const labelledBy = el.getAttribute('aria-labelledby')
      if (labelledBy?.split(/\s+/).some((id) => document.getElementById(id))) return true
      if (el.getAttribute('title')?.trim()) return true
      if (el.closest('label')) return true
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true
      return false
    }

    return [...document.querySelectorAll<HTMLElement>('input, select, textarea')]
      .filter((el) => el.offsetParent !== null && el.getAttribute('type') !== 'hidden')
      .filter((el) => !named(el))
      .map(describe)
  })
}

test.describe('form labelling', () => {
  test('every control in the shop grid is labelled', async ({ page }) => {
    await openShop(page)
    expect(await unnamedControls(page)).toEqual([])
  })

  test('every control along the checkout is labelled', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await openCart(page)
    expect(await unnamedControls(page)).toEqual([])

    await page.getByRole('button', { name: 'Zur Bestellung' }).click()
    await expect(page.getByLabel('E-Mail *')).toBeVisible()
    expect(await unnamedControls(page)).toEqual([])

    // The registration form is the biggest one — eleven fields.
    await page.getByRole('tab', { name: 'Konto anlegen' }).click()
    await expect(page.getByLabel('Vorname *')).toBeVisible()
    expect(await unnamedControls(page)).toEqual([])
  })

  test('clicking a label focuses its field', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await openCart(page)
    await page.getByRole('button', { name: 'Zur Bestellung' }).click()

    // Only a real for/id pair does this — a sibling label would not.
    await page.getByText('Passwort *').click()
    await expect(page.getByLabel('Passwort *')).toBeFocused()
  })

  test('the product card labels its variant picker per product', async ({ page }) => {
    await openShop(page)
    const card = productCard(page, 'Olivenöl')
    await expect(card.getByLabel('Gebindegröße für Olivenöl')).toBeVisible()
  })
})

test.describe('dialog semantics', () => {
  test('the welcome overlay is a named dialog', async ({ page }) => {
    await page.goto('/shop')
    const welcome = page.getByRole('dialog', { name: 'So funktioniert die Bestellung' })
    await expect(welcome).toBeVisible()
    await expect(welcome).toHaveAttribute('aria-modal', 'true')
    await welcome.getByRole('button', { name: 'Verstanden' }).click()
    await expect(welcome).toBeHidden()
  })

  test('Escape closes the welcome overlay', async ({ page }) => {
    await page.goto('/shop')
    const welcome = page.getByRole('dialog', { name: 'So funktioniert die Bestellung' })
    await expect(welcome).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(welcome).toBeHidden()
  })

  test('the cart is a dialog and Escape closes it', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    const sidebar = page.getByTestId('cart-sidebar')
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toHaveAttribute('role', 'dialog')
    await expect(sidebar).toHaveAttribute('aria-modal', 'true')

    await page.keyboard.press('Escape')
    await expect(sidebar).toBeHidden()
  })

  test('opening the cart moves focus into it', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    const sidebar = page.getByTestId('cart-sidebar')
    await expect(sidebar).toBeVisible()

    // Whatever has focus must live inside the dialog, otherwise the next Tab
    // would wander through the page behind the overlay.
    expect(
      await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="cart-sidebar"]')
        return panel?.contains(document.activeElement) ?? false
      }),
    ).toBe(true)
  })

  test('closing the cart returns focus to the trigger', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await expect(page.getByTestId('cart-sidebar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('cart-sidebar')).toBeHidden()

    // The add-to-cart button was the last thing the user activated.
    await expect(
      productCard(page, 'Honig').getByRole('button', { name: 'Auf die Bestellliste' }),
    ).toBeFocused()
  })

  test('Tab stays inside the open cart', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await expect(page.getByTestId('cart-sidebar')).toBeVisible()

    const insideAfterTabs = async (count: number) => {
      for (let i = 0; i < count; i++) await page.keyboard.press('Tab')
      return page.evaluate(() => {
        const panel = document.querySelector('[data-testid="cart-sidebar"]')
        return panel?.contains(document.activeElement) ?? false
      })
    }
    // More presses than the dialog has controls, so it has to wrap at least once.
    expect(await insideAfterTabs(15)).toBe(true)
  })

  test('the cookie dialog is named and Escape declines it', async ({ page }) => {
    await openShop(page)
    // The first add triggers the consent question; do not answer it here.
    await productCard(page, 'Honig').getByRole('button', { name: 'Auf die Bestellliste' }).click()

    const consent = page.getByRole('dialog', { name: 'Cookie-Hinweis' })
    await expect(consent).toBeVisible()
    await expect(consent).toHaveAttribute('aria-modal', 'true')

    await page.keyboard.press('Escape')
    await expect(consent).toBeHidden()
    // Declined means the item was not put on the list.
    await expect(page.getByTestId('cart-sidebar')).toBeHidden()
  })
})
