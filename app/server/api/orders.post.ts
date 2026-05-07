import type { RowDataPacket } from 'mysql2/promise'
import { requireSession } from '../utils/auth'
import { parseOrder } from '../utils/validate'
import { dbInsert, dbUpdate, dbUpdateExpr } from '../utils/dbWrite'
import { buildOrderMail, countryName } from '../utils/orderMail'
import { getMailer, MAIL_FROM, MAIL_OPERATOR } from '../utils/mailer'
import { SHIPPING_OPTIONS, PAYMENT_OPTIONS } from '../utils/checkoutOptions'

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
  products_tax_class_id: number
  tax_rate: number | null
  tax_description: string | null
}

interface TaxRateRow extends RowDataPacket {
  tax_class_id: number
  tax_rate: number
  tax_description: string
}

function gross(net: number, taxRate: number): number {
  return Math.round(net * (1 + taxRate / 100) * 100) / 100
}

function fmt(n: number): string {
  return `${n.toFixed(2).replace('.', ',')}&nbsp;EURO`
}

/**
 * For a given customer country, return the matching geo_zone_id used for tax rates.
 * - DE → zone 2 (Inland)
 * - AT → zone 3 (Ausland)
 * - everything else → null (no zone match → no tax applied, like the alt-shop)
 */
async function resolveTaxZone(db: import('mysql2/promise').Pool, countryId: number): Promise<number | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT geo_zone_id FROM zones_to_geo_zones WHERE zone_country_id = ? LIMIT 1',
    [countryId],
  )
  if (rows.length === 0) return null
  return Number(rows[0].geo_zone_id)
}

async function loadTaxRate(
  db: import('mysql2/promise').Pool,
  taxClassId: number,
  taxZoneId: number | null,
): Promise<{ rate: number, description: string } | null> {
  if (!taxClassId || taxZoneId == null) return null
  const [rows] = await db.execute<TaxRateRow[]>(
    'SELECT tax_rate, tax_description FROM tax_rates WHERE tax_class_id = ? AND tax_zone_id = ? LIMIT 1',
    [taxClassId, taxZoneId],
  )
  const row = rows[0]
  if (!row) return null
  return { rate: Number(row.tax_rate), description: String(row.tax_description || 'Mehrwertsteuer') }
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

  const taxZoneId = await resolveTaxZone(db, customer.entry_country_id)

  // Resolve products with tax rate filtered by the customer's zone
  // (the LEFT JOIN here will return NULL for tax_rate when zone doesn't match)
  const productIds = input.items.map(i => Number(i.productId))
  const placeholders = productIds.map(() => '?').join(',')
  const [prodRows] = await db.execute<ProductRow[]>(
    `SELECT p.products_id, p.products_model, p.products_price, pd.products_name,
            p.products_tax_class_id,
            tr.tax_rate, tr.tax_description
     FROM products p
     JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
     LEFT JOIN tax_rates tr ON tr.tax_class_id = p.products_tax_class_id AND tr.tax_zone_id ${taxZoneId == null ? 'IS NULL' : '= ?'}
     WHERE p.products_id IN (${placeholders}) AND p.products_status = 1`,
    taxZoneId == null ? productIds : [taxZoneId, ...productIds],
  )
  const productById = new Map(prodRows.map(r => [Number(r.products_id), r]))
  for (const item of input.items) {
    if (!productById.has(Number(item.productId))) {
      throw createError({ statusCode: 400, statusMessage: `Artikel ${item.productId} nicht verfügbar` })
    }
  }

  const country = countryName(customer.entry_country_id)

  // Compute gross unit price + accumulate tax per rate (one ot_tax row per distinct rate)
  const taxByDescription = new Map<string, { rate: number, total: number, sortOrder: number }>()
  let total = 0
  let subtotalGross = 0
  const lines = input.items.map((item, idx) => {
    const p = productById.get(Number(item.productId))!
    const rate = Number(p.tax_rate ?? 0)
    const description = String(p.tax_description ?? '')
    const unit = gross(Number(p.products_price), rate)
    const lineGross = Math.round(unit * item.quantity * 100) / 100
    subtotalGross += lineGross
    total += lineGross
    if (rate > 0 && description) {
      const lineNet = lineGross / (1 + rate / 100)
      const lineTax = lineGross - lineNet
      const existing = taxByDescription.get(description)
      taxByDescription.set(description, {
        rate,
        total: (existing?.total ?? 0) + lineTax,
        sortOrder: existing?.sortOrder ?? idx,
      })
    }
    return { item, p, rate, unit, lineGross }
  })

  // Shipping
  const shippingOpt = SHIPPING_OPTIONS[input.shippingMethod]
  const shippingTax = shippingOpt.taxClassId > 0
    ? await loadTaxRate(db, shippingOpt.taxClassId, taxZoneId)
    : null
  const shippingGross = shippingTax
    ? gross(shippingOpt.net, shippingTax.rate)
    : Math.round(shippingOpt.net * 100) / 100
  if (shippingTax && shippingGross > 0) {
    const shippingTaxAmount = shippingGross - shippingGross / (1 + shippingTax.rate / 100)
    const existing = taxByDescription.get(shippingTax.description)
    taxByDescription.set(shippingTax.description, {
      rate: shippingTax.rate,
      total: (existing?.total ?? 0) + shippingTaxAmount,
      sortOrder: existing?.sortOrder ?? 99,
    })
  }
  total = Math.round((total + shippingGross) * 100) / 100
  subtotalGross = Math.round(subtotalGross * 100) / 100

  // Payment
  const paymentOpt = PAYMENT_OPTIONS[input.paymentMethod]

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
    payment_method: paymentOpt.label,
    date_purchased: now,
    orders_status: 1,
    currency: 'EUR',
    currency_value: 1.0,
  }, { customerId: customer.customers_id, remoteIp })

  // Order line items
  for (const { item, p, rate, unit, lineGross } of lines) {
    await dbInsert(db, 'orders_products', {
      orders_id: orderId,
      products_id: p.products_id,
      products_model: p.products_model ?? '',
      products_name: p.products_name,
      products_price: Number(p.products_price),
      final_price: lineGross / item.quantity,
      products_tax: rate,
      products_quantity: item.quantity,
    }, { customerId: customer.customers_id, orderId, remoteIp })
  }

  // Totals: subtotal + (per-rate tax rows) + shipping + total — Format wie Alt-Shop
  await dbInsert(db, 'orders_total', {
    orders_id: orderId,
    title: 'Zwischensumme:',
    text: fmt(subtotalGross),
    value: subtotalGross,
    class: 'ot_subtotal',
    sort_order: 1,
  }, { customerId: customer.customers_id, orderId, remoteIp })

  await dbInsert(db, 'orders_total', {
    orders_id: orderId,
    title: shippingOpt.totalTitle,
    text: fmt(shippingGross),
    value: shippingGross,
    class: 'ot_shipping',
    sort_order: 2,
  }, { customerId: customer.customers_id, orderId, remoteIp })

  // Tax rows: one per distinct description (e.g. "Mehrwertsteuer", "Mehrwertsteuer ermäszigt")
  const sortedTax = [...taxByDescription.entries()].sort((a, b) => a[1].sortOrder - b[1].sortOrder)
  for (const [description, info] of sortedTax) {
    const value = Math.round(info.total * 100) / 100
    if (value === 0) continue
    await dbInsert(db, 'orders_total', {
      orders_id: orderId,
      title: `${description}:`,
      text: fmt(value),
      value: value,
      class: 'ot_tax',
      sort_order: 3,
    }, { customerId: customer.customers_id, orderId, remoteIp })
  }

  await dbInsert(db, 'orders_total', {
    orders_id: orderId,
    title: '<b>Summe</b>:',
    text: `<b>${fmt(total)}</b>`,
    value: total,
    class: 'ot_total',
    sort_order: 4,
  }, { customerId: customer.customers_id, orderId, remoteIp })

  // Lastschrift: persist IBAN data on the customer + order-specific row
  if (input.paymentMethod === 'lastschrift' && input.bankDetails) {
    const bd = input.bankDetails
    await dbInsert(db, 'banktransfer_iban', {
      orders_id: orderId,
      banktransfer_owner: bd.accountHolder,
      banktransfer_number: bd.iban,
      banktransfer_bankname: '',
      banktransfer_status: 0,
      banktransfer_prz: '00',
      banktransfer_fax: null,
    }, { customerId: customer.customers_id, orderId, remoteIp })
    try {
      await dbUpdate(db, 'customers',
        { customers_id: customer.customers_id },
        {
          customers_banktransfer_iban_owner: bd.accountHolder,
          customers_banktransfer_iban_number: bd.iban,
          customers_banktransfer_iban_bankname: '',
        },
        { customerId: customer.customers_id, orderId, remoteIp },
      )
    } catch (err) {
      console.warn('[orders/create] customers IBAN update failed:', err)
    }
  }

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
      items: lines.map(({ item, p, unit, lineGross }) => ({
        productId: String(p.products_id),
        name: p.products_name,
        variantSize: item.variantIndex !== undefined ? `Variante #${item.variantIndex + 1}` : undefined,
        quantity: item.quantity,
        unitPrice: unit,
        lineTotal: lineGross,
      })),
      total,
      shippingMethod: shippingOpt.module,
      shippingPrice: shippingGross,
      paymentMethod: paymentOpt.label,
      bankDetails: input.bankDetails,
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
