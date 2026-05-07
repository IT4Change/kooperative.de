import type { RowDataPacket } from 'mysql2/promise'
import { requireSession } from '../utils/auth'
import { parseOrder } from '../utils/validate'
import { dbInsert, dbUpdateExpr } from '../utils/dbWrite'
import { buildOrderMail, countryName } from '../utils/orderMail'
import { getMailer, MAIL_FROM, MAIL_OPERATOR } from '../utils/mailer'

interface CustomerRow extends RowDataPacket {
  customers_id: number
  customers_firstname: string
  customers_lastname: string
  customers_email_address: string
  customers_telephone: string
  entry_company: string | null
  entry_street_address: string
  entry_suburb: string | null
  entry_postcode: string
  entry_city: string
  entry_state: string | null
  entry_country_id: number
}

interface ProductRow extends RowDataPacket {
  products_id: number
  products_model: string | null
  products_price: number
  products_name: string
  tax_rate: number
}

function gross(net: number, taxRate: number): number {
  return Math.round(net * (1 + taxRate / 100) * 100) / 100
}

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const input = parseOrder(body)
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  const db = useDB()

  const [custRows] = await db.execute<CustomerRow[]>(
    `SELECT c.customers_id, c.customers_firstname, c.customers_lastname, c.customers_email_address, c.customers_telephone,
            ab.entry_company, ab.entry_street_address, ab.entry_suburb, ab.entry_postcode, ab.entry_city, ab.entry_state, ab.entry_country_id
     FROM customers c
     LEFT JOIN address_book ab ON ab.address_book_id = c.customers_default_address_id
     WHERE c.customers_id = ? LIMIT 1`,
    [session.customerId],
  )
  const customer = custRows[0]
  if (!customer || !customer.entry_street_address) {
    throw createError({ statusCode: 400, statusMessage: 'Kundendaten unvollständig' })
  }

  const productIds = input.items.map(i => Number(i.productId))
  const placeholders = productIds.map(() => '?').join(',')
  const [prodRows] = await db.execute<ProductRow[]>(
    `SELECT p.products_id, p.products_model, p.products_price, pd.products_name, COALESCE(tr.tax_rate, 0) AS tax_rate
     FROM products p
     JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
     LEFT JOIN tax_rates tr ON p.products_tax_class_id = tr.tax_class_id
     WHERE p.products_id IN (${placeholders}) AND p.products_status = 1`,
    productIds,
  )
  const productById = new Map(prodRows.map(r => [Number(r.products_id), r]))
  for (const item of input.items) {
    if (!productById.has(Number(item.productId))) {
      throw createError({ statusCode: 400, statusMessage: `Artikel ${item.productId} nicht verfügbar` })
    }
  }

  const country = countryName(customer.entry_country_id)

  // Compute totals (gross prices to match what the customer saw)
  let total = 0
  const lines = input.items.map((item) => {
    const p = productById.get(Number(item.productId))!
    const unit = gross(Number(p.products_price), Number(p.tax_rate))
    const lineTotal = Math.round(unit * item.quantity * 100) / 100
    total += lineTotal
    return { item, p, unit, lineTotal }
  })
  total = Math.round(total * 100) / 100

  const fullName = `${customer.customers_firstname} ${customer.customers_lastname}`.trim()
  const now = new Date()

  const orderId = await dbInsert(db, 'orders', {
    customers_id: customer.customers_id,
    customers_name: fullName,
    customers_company: customer.entry_company ?? null,
    customers_street_address: customer.entry_street_address,
    customers_suburb: customer.entry_suburb ?? null,
    customers_city: customer.entry_city,
    customers_postcode: customer.entry_postcode,
    customers_state: customer.entry_state ?? null,
    customers_country: country,
    customers_telephone: customer.customers_telephone || '',
    customers_email_address: customer.customers_email_address,
    customers_address_format_id: 5,
    delivery_name: fullName,
    delivery_company: customer.entry_company ?? null,
    delivery_street_address: customer.entry_street_address,
    delivery_suburb: customer.entry_suburb ?? null,
    delivery_city: customer.entry_city,
    delivery_postcode: customer.entry_postcode,
    delivery_state: customer.entry_state ?? null,
    delivery_country: country,
    delivery_address_format_id: 5,
    billing_name: fullName,
    billing_company: customer.entry_company ?? null,
    billing_street_address: customer.entry_street_address,
    billing_suburb: customer.entry_suburb ?? null,
    billing_city: customer.entry_city,
    billing_postcode: customer.entry_postcode,
    billing_state: customer.entry_state ?? null,
    billing_country: country,
    billing_address_format_id: 5,
    payment_method: 'vorkasse',
    last_modified: now,
    date_purchased: now,
    orders_status: 1,
    currency: 'EUR',
    currency_value: 1.0,
  }, { customerId: customer.customers_id, remoteIp })

  // Order line items
  for (const { item, p, unit, lineTotal } of lines) {
    await dbInsert(db, 'orders_products', {
      orders_id: orderId,
      products_id: p.products_id,
      products_model: p.products_model ?? '',
      products_name: p.products_name,
      products_price: Number(p.products_price),
      final_price: lineTotal / item.quantity,
      products_tax: Number(p.tax_rate),
      products_quantity: item.quantity,
    }, { customerId: customer.customers_id, orderId, remoteIp })
  }

  // Totals (sub_total + total only — keine Versandberechnung in Phase 1).
  // Format-Strings spiegeln das Alt-Shop-Schema (Komma-Dezimal, "EURO", &nbsp;).
  const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')}&nbsp;EURO`

  await dbInsert(db, 'orders_total', {
    orders_id: orderId,
    title: 'Zwischensumme:',
    text: fmt(total),
    value: total,
    class: 'ot_subtotal',
    sort_order: 1,
  }, { customerId: customer.customers_id, orderId, remoteIp })

  await dbInsert(db, 'orders_total', {
    orders_id: orderId,
    title: '<b>Summe</b>:',
    text: `<b>${fmt(total)}</b>`,
    value: total,
    class: 'ot_total',
    sort_order: 4,
  }, { customerId: customer.customers_id, orderId, remoteIp })

  // Status history (initial entry, exactly like checkout_process.php)
  await dbInsert(db, 'orders_status_history', {
    orders_id: orderId,
    orders_status_id: 1,
    date_added: now,
    customer_notified: 0,
    comments: input.notes ?? '',
  }, { customerId: customer.customers_id, orderId, remoteIp })

  // Increment products_ordered (sales counter; products_quantity untouched per project decision)
  for (const item of input.items) {
    try {
      await dbUpdateExpr(db, 'products',
        { products_id: Number(item.productId) },
        'products_ordered = products_ordered + ?',
        [item.quantity],
        { customerId: customer.customers_id, orderId, remoteIp },
      )
    } catch (err) {
      console.warn(`[orders/create] products_ordered update failed for ${item.productId}:`, err)
    }
  }

  // Send mail (after DB commit — failure here must not roll back the order)
  try {
    const mail = buildOrderMail({
      orderId,
      customer: {
        customerId: customer.customers_id,
        firstname: customer.customers_firstname,
        lastname: customer.customers_lastname,
        email: customer.customers_email_address,
        telephone: customer.customers_telephone || '',
      },
      shipping: {
        street: customer.entry_street_address,
        postcode: customer.entry_postcode,
        city: customer.entry_city,
        country,
      },
      items: lines.map(({ item, p, unit, lineTotal }) => ({
        productId: String(p.products_id),
        name: p.products_name,
        variantSize: item.variantIndex !== undefined ? `Variante #${item.variantIndex + 1}` : undefined,
        quantity: item.quantity,
        unitPrice: unit,
        lineTotal,
      })),
      total,
      notes: input.notes,
      adminBaseUrl: process.env.ADMIN_BASE_URL,
    })
    await getMailer().sendMail({
      from: MAIL_FROM,
      to: MAIL_OPERATOR,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  } catch (err) {
    console.error('[orders/create] mail send failed (order is committed):', err)
  }

  return { ok: true, orderId, total }
})
