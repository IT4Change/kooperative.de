import { test, expect } from '@playwright/test'

import { latestPending, mailLog, query, closeDb } from './helpers/db'
import { clearMails, to, waitForMail, waitForMailCount } from './helpers/maildev'
import { ADMIN, CUSTOMER, addToCart, checkout, openShop } from './helpers/shop'

import type { RowDataPacket } from 'mysql2/promise'

/**
 * The withdrawal function (§ 356a BGB) end to end: reachable from the footer
 * and from the receipt, no login needed, stored and linked to the order only
 * when number and address match, receipt with date and time to the customer,
 * notice to the operator, visible on the order in the admin.
 */
test.describe.configure({ mode: 'serial' })

interface WithdrawalRow extends RowDataPacket {
  id: number
  orders_id: number | null
  order_ref: string
  scope: string
  items: string | null
}

const latestWithdrawal = async () =>
  (await query<WithdrawalRow>('SELECT * FROM koop_withdrawal ORDER BY id DESC LIMIT 1'))[0]

test.afterAll(async () => {
  await closeDb()
})

test.beforeEach(async () => {
  await clearMails()
})

test('the footer of every page links the withdrawal function', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('contentinfo').getByRole('link', { name: 'Vertrag widerrufen' }).click()

  await expect(page).toHaveURL(/\/vertrag-widerrufen$/)
  await expect(page.getByRole('heading', { name: 'Vertrag widerrufen' })).toBeVisible()
})

test('a withdrawal from the receipt mail lands on the order', async ({ page }) => {
  await openShop(page)
  await addToCart(page, 'Honig')
  await checkout(page, { shipping: 'abholung' })
  const orderId = (await latestPending(CUSTOMER.email))!.orders_id!
  const receipt = await waitForMail(to(CUSTOMER.email), 'the receipt')
  const link = /https?:\/\/\S*\/vertrag-widerrufen\?bestellung=\d+/.exec(receipt.text)![0]
  await clearMails()

  await page.goto(link)
  // Signed in from the checkout: name and address are there, the number too.
  await expect(page.getByLabel('Bestellnummer')).toHaveValue(String(orderId))
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(CUSTOMER.email)
  await page.getByLabel('nur einzelne Artikel').check()
  await page.getByLabel('Welche Artikel?').fill('1× Honig')
  await page.getByRole('button', { name: 'Widerruf bestätigen' }).click()

  await expect(page.getByRole('heading', { name: 'Widerruf eingegangen' })).toBeVisible()
  await expect(page.getByTestId('withdrawal-received')).toContainText(/am \d\d\.\d\d\.\d{4} um/)

  const row = await latestWithdrawal()
  expect(row).toMatchObject({ orders_id: orderId, scope: 'partial', items: '1× Honig' })

  const mail = await waitForMail(to(CUSTOMER.email), 'the withdrawal receipt')
  expect(mail.subject).toBe(`[Kooperative Dürnau] Eingang Ihres Widerrufs zu Bestellung ${orderId}`)
  expect(mail.text).toMatch(/am \d\d\.\d\d\.\d{4} um \d\d:\d\d Uhr bei uns eingegangen/)
  expect(mail.text).toContain('Artikel: 1× Honig')
  await waitForMailCount(to('betrieb@example.org'), 1, 'operator notice')
  const log = await mailLog({ orderId })
  expect(log.map((l) => l.mail_type)).toEqual(
    expect.arrayContaining(['withdrawal_received', 'admin_withdrawal']),
  )
})

test.describe('admin', () => {
  test.use({ httpCredentials: { username: ADMIN.username, password: ADMIN.password } })

  test('shows the withdrawal on the order and in the list', async ({ page }) => {
    const row = (await latestWithdrawal())!

    await page.goto(`/admin/orders/${row.orders_id}`)
    await expect(page.getByTestId('withdrawal-notice')).toContainText('Artikel: 1× Honig')

    await page.goto('/admin/withdrawals')
    await expect(page.getByRole('link', { name: `#${row.orders_id}` })).toBeVisible()
  })
})

test('a declaration that matches no order is taken all the same', async ({ browser }) => {
  // A fresh context: no session, as for someone who never had an account here.
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/vertrag-widerrufen')
  await page.getByLabel('Name').fill('Max Muster')
  await page.getByLabel('E-Mail-Adresse').fill('max@example.org')
  await page.getByLabel('Bestellnummer').fill('999999')
  await page.getByRole('button', { name: 'Widerruf bestätigen' }).click()

  // Same answer as for a match — the form must not reveal which numbers exist.
  await expect(page.getByRole('heading', { name: 'Widerruf eingegangen' })).toBeVisible()
  expect(await latestWithdrawal()).toMatchObject({ order_ref: '999999', orders_id: null })
  await waitForMail(to('max@example.org'), 'the receipt for an unmatched declaration')
  await context.close()
})
