import { test, expect } from '@playwright/test'

import {
  latestPending,
  orderById,
  orderProducts,
  orderTotals,
  orderStatusHistory,
  mailLog,
  closeDb,
} from './helpers/db'
import { clearMails, waitForMail, waitForMailCount, to, confirmationLink } from './helpers/maildev'
import { CUSTOMER, addToCart, checkout, openCart, openShop, productCard } from './helpers/shop'

/**
 * The order lifecycle end to end: submit → koop_pending_order → confirmation mail
 * → token link → confirm → materialisation into the osCommerce tables.
 *
 * This is the part the unit tests cannot reach. The point is not that the UI
 * shows a success panel, but that the rows the old shop's admin reads are
 * written correctly — hence the direct DB assertions.
 */
test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await closeDb()
})

test.describe('order flow', () => {
  test.beforeEach(async () => {
    await clearMails()
  })

  test('an order is parked as pending and not yet written to the shop tables', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'abholung', payment: 'vorkasse' })

    const pending = await latestPending(CUSTOMER.email)
    expect(pending).toBeDefined()
    expect(pending!.status).toBe('pending')
    // Nothing may exist in the osCommerce tables before the customer confirms.
    expect(pending!.orders_id).toBeNull()

    // 11.90 for the Honig, Abholung has no fixed price.
    expect(Number(pending!.total)).toBeCloseTo(11.9, 2)
  })

  test('sends a confirmation request to the customer and a notice to the operator', async ({
    page,
  }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page)

    const customerMail = await waitForMail(to(CUSTOMER.email), 'the confirmation request')
    expect(customerMail.subject).toContain('Kooperative Dürnau')
    expect(customerMail.text).toContain('Honig')

    await waitForMailCount(to('betrieb@example.org'), 1, 'operator notice')

    const pending = await latestPending(CUSTOMER.email)
    const log = await mailLog({ pendingId: pending!.id })
    expect(log.map((l) => l.direction).sort()).toEqual(['to_admin', 'to_customer'])
  })

  test('the token link opens the review page with the pinned order content', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { notes: 'Bitte klingeln' })

    const mail = await waitForMail(to(CUSTOMER.email), 'the confirmation request')
    await page.goto(confirmationLink(mail))

    await expect(page.getByRole('heading', { name: 'Bestellung bestätigen' })).toBeVisible()
    await expect(page.getByText('Honig')).toBeVisible()
    await expect(page.getByText('Bitte klingeln')).toBeVisible()
  })

  test('confirming materialises the order into the osCommerce tables', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'dpd', payment: 'vorkasse' })

    const mail = await waitForMail(to(CUSTOMER.email), 'the confirmation request')
    await page.goto(confirmationLink(mail))
    await page.getByTestId('pending-confirm').click()
    await expect(page.getByRole('heading', { name: /bestätigt/i })).toBeVisible()

    const pending = await latestPending(CUSTOMER.email)
    expect(pending!.status).toBe('materialized')
    expect(pending!.orders_id).not.toBeNull()

    const orderId = pending!.orders_id!
    const order = await orderById(orderId)
    expect(order).toBeDefined()
    expect(order!.customers_email_address).toBe(CUSTOMER.email)
    expect(order!.customers_name).toBe(CUSTOMER.name)
    // Status 1 = "In Bearbeitung" — the entry point of the canonical flow.
    expect(order!.orders_status).toBe(1)
    expect(order!.payment_method).toBe('Bezahlung mit Vorkasse')

    const lines = await orderProducts(orderId)
    expect(lines).toHaveLength(1)
    expect(lines[0].products_name).toBe('Honig')
    expect(lines[0].products_quantity).toBe(1)

    const totals = await orderTotals(orderId)
    const byClass = Object.fromEntries(totals.map((t) => [t.class, Number(t.value)]))
    // 11.90 goods + 7.50 DPD shipping = 19.40
    expect(byClass.ot_subtotal).toBeCloseTo(11.9, 2)
    expect(byClass.ot_shipping).toBeCloseTo(7.5, 2)
    expect(byClass.ot_total).toBeCloseTo(19.4, 2)
    // The 19 % share of both goods and shipping.
    expect(byClass.ot_tax).toBeCloseTo(3.1, 2)

    const history = await orderStatusHistory(orderId)
    expect(history).not.toHaveLength(0)
    expect(history[0].orders_status_id).toBe(1)
  })

  test('the price is recomputed from the database, not taken from the browser', async ({
    page,
  }) => {
    await openShop(page)
    await addToCart(page, 'Brot')
    await openCart(page)
    // 3.00 net at the reduced rate — the cart must show the gross price.
    await expect(page.getByTestId('cart-total')).toHaveText(/3,?\.?21/)

    await checkout(page, { shipping: 'abholung' })
    const pending = await latestPending(CUSTOMER.email)
    expect(Number(pending!.total)).toBeCloseTo(3.21, 2)
  })

  test('a quantity-tier product is charged at its tier price', async ({ page }) => {
    await openShop(page)
    await productCard(page, 'Karte').getByTestId('product-quantity').fill('10')
    await addToCart(page, 'Karte')
    await checkout(page, { shipping: 'abholung' })

    const pending = await latestPending(CUSTOMER.email)
    // 10 × 1.79 gross (the 1.50 net tier), not 10 × 2.38
    expect(Number(pending!.total)).toBeCloseTo(17.9, 2)
  })

  test('confirming twice does not create a second order', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'abholung' })

    const mail = await waitForMail(to(CUSTOMER.email), 'the confirmation request')
    const link = confirmationLink(mail)

    await page.goto(link)
    await page.getByTestId('pending-confirm').click()
    await expect(page.getByRole('heading', { name: /bestätigt/i })).toBeVisible()
    const first = await latestPending(CUSTOMER.email)

    // Re-opening the link must show the confirmed state, not another button.
    await page.goto(link)
    await expect(page.getByRole('heading', { name: /bestätigt/i })).toBeVisible()
    await expect(page.getByTestId('pending-confirm')).toHaveCount(0)

    const second = await latestPending(CUSTOMER.email)
    expect(second!.orders_id).toBe(first!.orders_id)
  })
})
