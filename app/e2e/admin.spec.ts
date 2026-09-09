import { test, expect } from '@playwright/test'

import { latestPending, orderById, orderStatusHistory, mailLog, closeDb } from './helpers/db'
import { clearMails, waitForMail, to, confirmationLink } from './helpers/maildev'
import { ADMIN, CUSTOMER, addToCart, checkout, openShop } from './helpers/shop'

/**
 * The /admin area replaces the old osCommerce backend. It is protected by HTTP
 * Basic auth and writes into the same tables the legacy admin used, so the
 * assertions check the DB rows, not just the screen.
 */
test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await closeDb()
})

/** Places an order and confirms it, so the admin has something to work on. */
async function confirmedOrder(page: import('@playwright/test').Page): Promise<number> {
  await clearMails()
  await openShop(page)
  await addToCart(page, 'Honig')
  await checkout(page, { shipping: 'abholung', payment: 'vorkasse' })
  const mail = await waitForMail(to(CUSTOMER.email), 'the confirmation request')
  await page.goto(confirmationLink(mail))
  await page.getByRole('button', { name: /verbindlich bestätigen/ }).click()
  await expect(page.getByRole('heading', { name: /bestätigt/i })).toBeVisible()
  const pending = await latestPending(CUSTOMER.email)
  return pending!.orders_id!
}

test.describe('admin access', () => {
  test('refuses access without credentials', async ({ page }) => {
    const res = await page.request.get('/admin/api/dashboard')
    expect(res.status()).toBe(401)
    expect(res.headers()['www-authenticate']).toContain('Basic')
  })

  test('refuses wrong credentials', async ({ browser }) => {
    const ctx = await browser.newContext({
      httpCredentials: { username: ADMIN.username, password: 'falsch' },
    })
    const res = await ctx.request.get('/admin/api/dashboard')
    expect(res.status()).toBe(401)
    await ctx.close()
  })

  /**
   * Nitro tells JSON clients from browsers by looking for a leading "/api/" in
   * the path. The admin endpoints sit under "/admin/api/" so they can share the
   * pages' Basic-Auth realm, which used to make Nitro answer HTML-accepting
   * clients with the rendered Nuxt error page — wrong content type for an API,
   * and two "[Vue Router warn] No match found" lines per request in the log.
   * server/middleware/admin-auth.ts corrects the classification.
   */
  test('answers API errors with JSON even for an HTML-accepting client', async ({ page }) => {
    const res = await page.request.get('/admin/api/dashboard', {
      headers: { accept: 'text/html' },
    })
    expect(res.status()).toBe(401)
    expect(res.headers()['content-type']).toContain('application/json')
    expect(await res.json()).toMatchObject({ statusCode: 401 })
  })

  test('still renders the HTML error page for the admin pages themselves', async ({ page }) => {
    const res = await page.request.get('/admin', { headers: { accept: 'text/html' } })
    expect(res.status()).toBe(401)
    expect(res.headers()['content-type']).toContain('text/html')
  })
})

test.describe('admin', () => {
  test.use({ httpCredentials: ADMIN })

  test('shows the dashboard statistics', async ({ page }) => {
    const res = await page.request.get('/admin/api/dashboard')
    expect(res.ok()).toBe(true)
    const data = await res.json()
    // Seven seeded products, six of them active (one has products_status = 0).
    expect(data.stats.productsActive).toBe(6)
    expect(data.stats.customers).toBeGreaterThanOrEqual(1)
    expect(data.statuses.map((s: { id: number }) => s.id)).toEqual([1, 2, 3, 4])
  })

  test('lists a pending order before it is confirmed', async ({ page }) => {
    await clearMails()
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'abholung' })
    const pending = await latestPending(CUSTOMER.email)

    const res = await page.request.get('/admin/api/orders')
    const data = await res.json()
    const row = data.orders.find(
      (o: { kind: string; id: number }) => o.kind === 'pending' && o.id === pending!.id,
    )
    expect(row).toBeDefined()
    expect(row.statusName).toBe('Bestätigung ausstehend')
    expect(row.origin).toBe('neu')
  })

  test('opens the detail page of a confirmed order', async ({ page }) => {
    const orderId = await confirmedOrder(page)

    await page.goto(`/admin/orders/${orderId}`)
    await expect(page.getByText(CUSTOMER.name).first()).toBeVisible()
    await expect(page.getByText('Honig').first()).toBeVisible()
    await expect(page.getByText('In Bearbeitung').first()).toBeVisible()
  })

  test('changes the status and notifies the customer', async ({ page }) => {
    const orderId = await confirmedOrder(page)
    await clearMails()

    await page.goto(`/admin/orders/${orderId}`)
    await page.getByLabel('Status setzen').selectOption('3') // Versendet
    await page.getByLabel('Kunde per E-Mail benachrichtigen').check()
    await page.getByRole('button', { name: 'Status aktualisieren' }).click()

    // The order row and its history must both reflect the new status.
    await expect
      .poll(async () => (await orderById(orderId))?.orders_status, {
        message: 'orders.orders_status becomes 3',
      })
      .toBe(3)

    const history = await orderStatusHistory(orderId)
    expect(history.map((h) => h.orders_status_id)).toContain(3)

    const mail = await waitForMail(to(CUSTOMER.email), 'the status notification')
    expect(mail.subject).toContain('Versendet')
    expect(mail.text).toContain(String(orderId))

    const log = await mailLog({ orderId })
    expect(log.some((l) => l.mail_type === 'status_notification')).toBe(true)
  })

  test('changes the status silently when notification is unchecked', async ({ page }) => {
    const orderId = await confirmedOrder(page)
    await clearMails()

    await page.goto(`/admin/orders/${orderId}`)
    await page.getByLabel('Status setzen').selectOption('2') // Versandbereit
    await page.getByLabel('Kunde per E-Mail benachrichtigen').uncheck()
    await page.getByRole('button', { name: 'Status aktualisieren' }).click()

    await expect
      .poll(async () => (await orderById(orderId))?.orders_status, {
        message: 'orders.orders_status becomes 2',
      })
      .toBe(2)

    // Give a stray mail a chance to arrive before declaring the inbox empty.
    await page.waitForTimeout(1000)
    const log = await mailLog({ orderId })
    expect(log.filter((l) => l.mail_type === 'status_notification')).toHaveLength(0)
  })
})
