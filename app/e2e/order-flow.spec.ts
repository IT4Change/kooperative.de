import { test, expect } from '@playwright/test'

import {
  latestPending,
  orderById,
  orderProducts,
  orderTotals,
  orderStatusHistory,
  mailLog,
  pendingById,
  seedLegacyPending,
  closeDb,
} from './helpers/db'
import { importLegalFixtures } from './helpers/legal'
import { clearMails, waitForMail, waitForMailCount, to, confirmationLink } from './helpers/maildev'
import { CUSTOMER, addToCart, checkout, openCart, openShop, productCard } from './helpers/shop'

/**
 * The order lifecycle end to end, as a standard shop: "Zahlungspflichtig
 * bestellen" → order written to the osCommerce tables (status 1) → receipt to
 * the customer, notice to the operator → the mail link shows the order.
 *
 * This is the part the unit tests cannot reach. The point is not that the UI
 * shows a success panel, but that the rows the old shop's admin reads are
 * written correctly — hence the direct DB assertions.
 *
 * The former confirmation flow is kept only for orders placed before the
 * switch; the last test walks it on a seeded record of that kind.
 */
test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ baseURL }) => {
  // The receipt carries the live AGB and Widerrufsbelehrung.
  await importLegalFixtures(baseURL!)
})

test.afterAll(async () => {
  await closeDb()
})

test.describe('order flow', () => {
  test.beforeEach(async () => {
    await clearMails()
  })

  test('an order is written straight to the shop tables', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'abholung', payment: 'vorkasse' })

    const pending = await latestPending(CUSTOMER.email)
    expect(pending).toBeDefined()
    // No confirmation round trip: the record is materialised at once.
    expect(pending!.status).toBe('materialized')
    expect(pending!.confirmed_via).toBe('direct')
    expect(pending!.orders_id).not.toBeNull()
    // 11.90 for the Honig, Abholung has no fixed price.
    expect(Number(pending!.total)).toBeCloseTo(11.9, 2)

    // The customer sees the order number right away.
    await expect(page.getByTestId('cart-success')).toContainText(`Nr. ${pending!.orders_id}`)
  })

  test('sends a receipt to the customer and a notice to the operator', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page)
    const pending = await latestPending(CUSTOMER.email)
    const orderId = pending!.orders_id!

    const customerMail = await waitForMail(to(CUSTOMER.email), 'the receipt')
    expect(customerMail.subject).toBe(`[Kooperative Dürnau] Eingang Ihrer Bestellung #${orderId}`)
    expect(customerMail.text).toContain('Honig')
    // A receipt, not an acceptance (AGB § 2).
    expect(customerMail.text).toContain('noch keine Annahme')
    // The contract text on a durable medium (§ 312f Abs. 2 BGB).
    expect(customerMail.text).toMatch(/==== Allgemeine Geschäftsbedingungen \(Fassung \d+\) ====/)
    expect(customerMail.text).toMatch(/==== Widerrufsbelehrung \(Fassung \d+\) ====/)

    await waitForMailCount(to('betrieb@example.org'), 1, 'operator notice')

    const log = await mailLog({ orderId })
    expect(log.map((l) => l.mail_type).sort()).toEqual(['admin_new_order', 'order_received'])
  })

  test('the mail link shows the order without asking for a confirmation', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { notes: 'Bitte klingeln' })
    const orderId = (await latestPending(CUSTOMER.email))!.orders_id!

    const mail = await waitForMail(to(CUSTOMER.email), 'the receipt')
    await page.goto(confirmationLink(mail))

    await expect(
      page.getByRole('heading', { name: `Ihre Bestellung Nr. ${orderId}` }),
    ).toBeVisible()
    await expect(page.getByText('Honig')).toBeVisible()
    await expect(page.getByText('Bitte klingeln')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zahlungspflichtig bestellen' })).toHaveCount(0)
  })

  test('the order lands complete in the osCommerce tables', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'dpd', payment: 'vorkasse' })

    const orderId = (await latestPending(CUSTOMER.email))!.orders_id!
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
    await productCard(page, 'Karte').getByLabel('Anz.').fill('10')
    await addToCart(page, 'Karte')
    await checkout(page, { shipping: 'abholung' })

    const pending = await latestPending(CUSTOMER.email)
    // 10 × 1.79 gross (the 1.50 net tier), not 10 × 2.38
    expect(Number(pending!.total)).toBeCloseTo(17.9, 2)
  })

  test('the same checkout request twice places one order', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'abholung' })
    const { input } = JSON.parse((await latestPending(CUSTOMER.email))!.payload) as {
      input: Record<string, unknown>
    }
    await clearMails()

    // A retry after a lost response: same body, same key, same session.
    const body = { ...input, idempotencyKey: crypto.randomUUID() }
    // From inside the page, like the shop itself: same cookie, same origin.
    const post = async () =>
      page.evaluate(async (data) => {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
        })
        return { status: res.status, body: (await res.json()) as { orderId: number } }
      }, body)
    const first = await post()
    const second = await post()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.orderId).toBe(first.body.orderId)
    const a = first.body
    // One receipt — a second would read as a second order.
    const log = await mailLog({ orderId: a.orderId })
    expect(log.filter((l) => l.mail_type === 'order_received')).toHaveLength(1)
  })

  test('an order from before the switch can still be confirmed, once', async ({ page }) => {
    await openShop(page)
    await addToCart(page, 'Honig')
    await checkout(page, { shipping: 'abholung' })
    const legacy = await seedLegacyPending((await latestPending(CUSTOMER.email))!.id)
    const link = `/bestellung/bestaetigen?token=${legacy.token}`

    await page.goto(link)
    await expect(page.getByRole('heading', { name: 'Bestellung bestätigen' })).toBeVisible()
    await page.getByRole('button', { name: 'Zahlungspflichtig bestellen' }).click()
    await expect(page.getByRole('heading', { name: /bestätigt/i })).toBeVisible()
    const first = await pendingById(legacy.id)
    expect(first!.status).toBe('materialized')
    expect(first!.confirmed_via).toBe('link')

    // Re-opening the link must show the confirmed state, not another button.
    await page.goto(link)
    await expect(page.getByRole('heading', { name: /bestätigt/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zahlungspflichtig bestellen' })).toHaveCount(0)

    const second = await pendingById(legacy.id)
    expect(second!.orders_id).toBe(first!.orders_id)
  })
})
