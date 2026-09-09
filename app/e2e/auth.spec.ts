import { test, expect } from '@playwright/test'

import { api } from './helpers/api'
import { countCustomers, closeDb } from './helpers/db'
import { CUSTOMER, addToCart, openCart, openShop, login } from './helpers/shop'

/**
 * Registration and login run against the real customers/address_book tables and
 * the osCommerce password format (md5:salt). The seeded customer proves that a
 * password written by the seed is accepted by the app — i.e. both sides agree on
 * the hash format.
 */
test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await closeDb()
})

/** Gets as far as the auth step of the checkout. */
async function reachAuthStep(page: import('@playwright/test').Page) {
  await openShop(page)
  await addToCart(page, 'Honig')
  await openCart(page)
  await page.getByRole('button', { name: 'Zur Bestellung' }).click()
  await expect(page.getByLabel('E-Mail *')).toBeVisible()
}

test.describe('authentication', () => {
  test('logs the seeded customer in with the stored osCommerce hash', async ({ page }) => {
    await reachAuthStep(page)
    await login(page)
    // Reaching shipping/payment means the session was established.
    await expect(page.locator('input[name="shipping"]').first()).toBeVisible()
  })

  test('rejects a wrong password without leaking whether the account exists', async ({ page }) => {
    await reachAuthStep(page)
    await page.getByLabel('E-Mail *').fill(CUSTOMER.email)
    await page.getByLabel('Passwort *').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page.getByText(/E-Mail oder Passwort/i)).toBeVisible()
    await expect(page.locator('input[name="shipping"]')).toHaveCount(0)
  })

  test('rejects an unknown account with the same message', async ({ page }) => {
    await reachAuthStep(page)
    await page.getByLabel('E-Mail *').fill('nobody@example.org')
    await page.getByLabel('Passwort *').fill('whatever-password')
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page.getByText(/E-Mail oder Passwort/i)).toBeVisible()
  })

  test('creates a customer and a default address on registration', async ({ page }) => {
    await page.goto('/')
    const email = `neu-${Date.now()}@example.org`
    expect(await countCustomers(email)).toBe(0)

    const res = await api(page, 'POST', '/api/auth/register', {
      gender: 'f',
      firstname: 'Neue',
      lastname: 'Kundin',
      dob: '1990-06-15',
      email,
      telephone: '0711 999',
      password: 'ein-gutes-passwort',
      street: 'Teststraße 1',
      postcode: '70173',
      city: 'Stuttgart',
      country: 'DE',
    })
    expect(res.ok).toBe(true)
    expect(await countCustomers(email)).toBe(1)

    // The session cookie from the registration must authenticate the next call,
    // and the default address must be linked — /api/auth/me joins address_book
    // over customers_default_address_id, which registration patches afterwards.
    const me = await api(page, 'GET', '/api/auth/me')
    expect(me.ok).toBe(true)
    expect(me.data).toMatchObject({
      authenticated: true,
      email,
      address: { street: 'Teststraße 1', postcode: '70173', city: 'Stuttgart', countryId: 81 },
    })
  })

  test('refuses a second registration with the same address', async ({ page }) => {
    await page.goto('/')
    const email = `doppelt-${Date.now()}@example.org`
    const payload = {
      gender: 'm',
      firstname: 'Doppel',
      lastname: 'Gänger',
      dob: '1985-01-01',
      email,
      telephone: '0711 111',
      password: 'ein-gutes-passwort',
      street: 'Teststraße 2',
      postcode: '70173',
      city: 'Stuttgart',
      country: 'DE',
    }
    expect((await api(page, 'POST', '/api/auth/register', payload)).ok).toBe(true)

    const second = await api(page, 'POST', '/api/auth/register', payload)
    expect(second.status).toBe(409)
    expect(await countCustomers(email)).toBe(1)
  })

  test('rejects a country the shop does not ship to', async ({ page }) => {
    await page.goto('/')
    const res = await api(page, 'POST', '/api/auth/register', {
      gender: 'd',
      firstname: 'Aus',
      lastname: 'Land',
      dob: '1985-01-01',
      email: `ausland-${Date.now()}@example.org`,
      telephone: '0711 222',
      password: 'ein-gutes-passwort',
      street: 'Rue 1',
      postcode: '75001',
      city: 'Paris',
      country: 'FR',
    })
    expect(res.status).toBe(400)
  })
})
