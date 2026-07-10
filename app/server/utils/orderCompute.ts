import type { Pool, RowDataPacket } from 'mysql2/promise'
import { dbInsert, dbUpdate, dbUpdateExpr } from './dbWrite'
import { countryName } from './orderMail'
import { loadCatalog } from './catalog'
import { SHIPPING_OPTIONS, PAYMENT_OPTIONS } from './checkoutOptions'
import type { ShippingMethod, PaymentMethod } from './checkoutOptions'
import type { Product } from '~/data/products'

/** Mirror of findTierIndex (app/data/products.ts) for quantity-tier products. */
function tierIndex(variants: readonly { minQty?: number }[], quantity: number): number {
  let best = 0
  for (let i = 1; i < variants.length; i++) {
    if (variants[i].minQty && quantity >= (variants[i].minQty as number)) best = i
  }
  return best
}

/**
 * Order pricing + persistence, split so the SAME computation can be pinned at
 * submit time (stored in koop_pending_order.payload) and inserted into the
 * osCommerce tables later, at confirmation ("materialize-on-confirm"). This is
 * the logic previously inlined in api/orders.post.ts.
 */

export interface OrderInput {
  items: { productId: number | string, quantity: number, variantIndex?: number }[]
  shippingMethod: ShippingMethod
  paymentMethod: PaymentMethod
  notes?: string
  bankDetails?: { accountHolder: string, iban: string }
}

export interface CompLine {
  productId: number
  model: string
  name: string
  priceNet: number
  unitGross: number
  tax: number
  quantity: number
  lineGross: number
  variantIndex?: number
}

export interface CompTaxRow { description: string, rate: number, total: number, sortOrder: number }

export interface OrderComputation {
  customer: {
    customerId: number
    firstname: string
    lastname: string
    name: string
    company: string | null
    street: string
    suburb: string | null
    city: string
    postcode: string
    state: string | null
    country: string
    telephone: string
    email: string
  }
  lines: CompLine[]
  subtotalGross: number
  taxRows: CompTaxRow[]
  shipping: { module: string, totalTitle: string, gross: number }
  payment: { label: string, method: PaymentMethod }
  bankDetails?: { accountHolder: string, iban: string }
  notes?: string
  total: number
}

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

function gross(net: number, taxRate: number): number {
  return Math.round(net * (1 + taxRate / 100) * 100) / 100
}

function fmt(n: number): string {
  return `${n.toFixed(2).replace('.', ',')}&nbsp;EURO`
}

async function resolveTaxZone(db: Pool, countryId: number): Promise<number | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT geo_zone_id FROM zones_to_geo_zones WHERE zone_country_id = ? LIMIT 1',
    [countryId],
  )
  if (rows.length === 0) return null
  return Number(rows[0].geo_zone_id)
}

async function loadTaxRate(db: Pool, taxClassId: number, taxZoneId: number | null): Promise<{ rate: number, description: string } | null> {
  if (!taxClassId || taxZoneId == null) return null
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT tax_rate, tax_description FROM tax_rates WHERE tax_class_id = ? AND tax_zone_id = ? LIMIT 1',
    [taxClassId, taxZoneId],
  )
  const row = rows[0]
  if (!row) return null
  return { rate: Number(row.tax_rate), description: String(row.tax_description || 'Mehrwertsteuer') }
}

/**
 * Compute the full order (prices, taxes, shipping) from the current DB state and
 * the customer's default address. Pure computation — performs no writes. The
 * result is JSON-serializable and gets stored as the pinned pending payload.
 */
export async function computeOrder(db: Pool, customerId: number, input: OrderInput): Promise<OrderComputation> {
  const [custRows] = await db.execute<CustomerRow[]>(
    `SELECT c.customers_id, c.customers_firstname, c.customers_lastname, c.customers_email_address, c.customers_telephone,
            ab.entry_company, ab.entry_street_address, ab.entry_suburb, ab.entry_postcode, ab.entry_city, ab.entry_state, ab.entry_country_id
     FROM customers c
     LEFT JOIN address_book ab ON ab.address_book_id = c.customers_default_address_id
     WHERE c.customers_id = ? LIMIT 1`,
    [customerId],
  )
  const customer = custRows[0]
  if (!customer || !customer.entry_street_address) {
    throw createError({ statusCode: 400, statusMessage: 'Kundendaten unvollständig' })
  }

  const country = countryName(customer.entry_country_id)
  const taxZoneId = await resolveTaxZone(db, customer.entry_country_id)

  // Resolve each ordered item to its concrete osCommerce product. Size/quantity
  // variants are SEPARATE products; the cart sends the group's base id + variantIndex
  // (or, for quantity tiers, just the quantity). We map that to the real variant
  // product via the SAME grouping the storefront uses — otherwise the base product
  // (and its price/name) would be used regardless of the chosen size.
  const catalog = await loadCatalog(db)
  const productByGroupId = new Map<string, Product>(catalog.products.map(p => [p.id, p]))
  const resolvedItems = input.items.map((item) => {
    const gp = productByGroupId.get(String(item.productId))
    let effId = Number(item.productId)
    if (gp?.variants && gp.variants.length > 0) {
      const idx = gp.variantType === 'quantity'
        ? tierIndex(gp.variants, item.quantity)
        : Math.min(Math.max(item.variantIndex ?? 0, 0), gp.variants.length - 1)
      const vid = gp.variants[idx]?.productId
      if (vid) effId = Number(vid)
    }
    return { item, effId }
  })

  const productIds = resolvedItems.map(r => r.effId)
  const placeholders = productIds.map(() => '?').join(',')
  const [prodRows] = await db.execute<ProductRow[]>(
    `SELECT p.products_id, p.products_model, p.products_price, pd.products_name,
            p.products_tax_class_id, tr.tax_rate, tr.tax_description
     FROM products p
     JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
     LEFT JOIN tax_rates tr ON tr.tax_class_id = p.products_tax_class_id AND tr.tax_zone_id ${taxZoneId == null ? 'IS NULL' : '= ?'}
     WHERE p.products_id IN (${placeholders}) AND p.products_status = 1`,
    taxZoneId == null ? productIds : [taxZoneId, ...productIds],
  )
  const productById = new Map(prodRows.map(r => [Number(r.products_id), r]))
  for (const { item, effId } of resolvedItems) {
    if (!productById.has(effId)) {
      throw createError({ statusCode: 400, statusMessage: `Artikel ${item.productId} nicht verfügbar` })
    }
  }

  const taxByDescription = new Map<string, CompTaxRow>()
  let subtotalGross = 0
  const lines: CompLine[] = resolvedItems.map(({ item, effId }, idx) => {
    const p = productById.get(effId)!
    const rate = Number(p.tax_rate ?? 0)
    const description = String(p.tax_description ?? '')
    const unit = gross(Number(p.products_price), rate)
    const lineGross = Math.round(unit * item.quantity * 100) / 100
    subtotalGross += lineGross
    if (rate > 0 && description) {
      const lineNet = lineGross / (1 + rate / 100)
      const lineTax = lineGross - lineNet
      const existing = taxByDescription.get(description)
      taxByDescription.set(description, {
        description,
        rate,
        total: (existing?.total ?? 0) + lineTax,
        sortOrder: existing?.sortOrder ?? idx,
      })
    }
    return {
      productId: Number(p.products_id),
      model: String(p.products_model ?? ''),
      name: String(p.products_name),
      priceNet: Number(p.products_price),
      unitGross: unit,
      tax: rate,
      quantity: item.quantity,
      lineGross,
      variantIndex: item.variantIndex,
    }
  })

  const shippingOpt = SHIPPING_OPTIONS[input.shippingMethod]
  const shippingTax = shippingOpt.taxClassId > 0 ? await loadTaxRate(db, shippingOpt.taxClassId, taxZoneId) : null
  const shippingGross = shippingTax ? gross(shippingOpt.net, shippingTax.rate) : Math.round(shippingOpt.net * 100) / 100
  if (shippingTax && shippingGross > 0) {
    const shippingTaxAmount = shippingGross - shippingGross / (1 + shippingTax.rate / 100)
    const existing = taxByDescription.get(shippingTax.description)
    taxByDescription.set(shippingTax.description, {
      description: shippingTax.description,
      rate: shippingTax.rate,
      total: (existing?.total ?? 0) + shippingTaxAmount,
      sortOrder: existing?.sortOrder ?? 99,
    })
  }

  subtotalGross = Math.round(subtotalGross * 100) / 100
  const total = Math.round((subtotalGross + shippingGross) * 100) / 100
  const paymentOpt = PAYMENT_OPTIONS[input.paymentMethod]

  return {
    customer: {
      customerId: Number(customer.customers_id),
      firstname: String(customer.customers_firstname || ''),
      lastname: String(customer.customers_lastname || ''),
      name: `${customer.customers_firstname} ${customer.customers_lastname}`.trim(),
      company: customer.entry_company ?? null,
      street: String(customer.entry_street_address),
      suburb: customer.entry_suburb ?? null,
      city: String(customer.entry_city),
      postcode: String(customer.entry_postcode),
      state: customer.entry_state ?? null,
      country,
      telephone: String(customer.customers_telephone || ''),
      email: String(customer.customers_email_address || ''),
    },
    lines,
    subtotalGross,
    taxRows: [...taxByDescription.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    shipping: { module: shippingOpt.module, totalTitle: shippingOpt.totalTitle, gross: shippingGross },
    payment: { label: paymentOpt.label, method: input.paymentMethod },
    bankDetails: input.bankDetails,
    notes: input.notes,
    total,
  }
}

/**
 * Insert a (previously computed, pinned) order into the osCommerce tables as a
 * normal Status-1 order — identical shape to what api/orders.post.ts produced
 * before. Returns the new orders_id. All writes go through dbWrite (audited).
 */
export async function insertComputedOrder(db: Pool, comp: OrderComputation, ctx: { remoteIp?: string } = {}): Promise<number> {
  const c = comp.customer
  const now = new Date()
  const wc = { customerId: c.customerId, remoteIp: ctx.remoteIp }

  const orderId = await dbInsert(db, 'orders', {
    customers_id: c.customerId,
    customers_name: c.name,
    customers_company: c.company,
    customers_street_address: c.street,
    customers_suburb: c.suburb,
    customers_city: c.city,
    customers_postcode: c.postcode,
    customers_state: c.state,
    customers_country: c.country,
    customers_telephone: c.telephone,
    customers_email_address: c.email,
    customers_address_format_id: 5,
    delivery_name: c.name,
    delivery_company: c.company,
    delivery_street_address: c.street,
    delivery_suburb: c.suburb,
    delivery_city: c.city,
    delivery_postcode: c.postcode,
    delivery_state: c.state,
    delivery_country: c.country,
    delivery_address_format_id: 5,
    billing_name: c.name,
    billing_company: c.company,
    billing_street_address: c.street,
    billing_suburb: c.suburb,
    billing_city: c.city,
    billing_postcode: c.postcode,
    billing_state: c.state,
    billing_country: c.country,
    billing_address_format_id: 5,
    payment_method: comp.payment.label,
    date_purchased: now,
    orders_status: 1,
    currency: 'EUR',
    currency_value: 1.0,
  }, wc)

  const oc = { customerId: c.customerId, orderId, remoteIp: ctx.remoteIp }

  for (const l of comp.lines) {
    await dbInsert(db, 'orders_products', {
      orders_id: orderId,
      products_id: l.productId,
      products_model: l.model,
      products_name: l.name,
      products_price: l.priceNet,
      final_price: l.lineGross / l.quantity,
      products_tax: l.tax,
      products_quantity: l.quantity,
    }, oc)
  }

  await dbInsert(db, 'orders_total', {
    orders_id: orderId, title: 'Zwischensumme:', text: fmt(comp.subtotalGross),
    value: comp.subtotalGross, class: 'ot_subtotal', sort_order: 1,
  }, oc)
  await dbInsert(db, 'orders_total', {
    orders_id: orderId, title: comp.shipping.totalTitle, text: fmt(comp.shipping.gross),
    value: comp.shipping.gross, class: 'ot_shipping', sort_order: 2,
  }, oc)
  for (const t of comp.taxRows) {
    const value = Math.round(t.total * 100) / 100
    if (value === 0) continue
    await dbInsert(db, 'orders_total', {
      orders_id: orderId, title: `${t.description}:`, text: fmt(value),
      value, class: 'ot_tax', sort_order: 3,
    }, oc)
  }
  await dbInsert(db, 'orders_total', {
    orders_id: orderId, title: '<b>Summe</b>:', text: `<b>${fmt(comp.total)}</b>`,
    value: comp.total, class: 'ot_total', sort_order: 4,
  }, oc)

  if (comp.payment.method === 'lastschrift' && comp.bankDetails) {
    const bd = comp.bankDetails
    await dbInsert(db, 'banktransfer_iban', {
      orders_id: orderId, banktransfer_owner: bd.accountHolder, banktransfer_number: bd.iban,
      banktransfer_bankname: '', banktransfer_status: 0, banktransfer_prz: '00', banktransfer_fax: null,
    }, oc)
    try {
      await dbUpdate(db, 'customers', { customers_id: c.customerId }, {
        customers_banktransfer_iban_owner: bd.accountHolder,
        customers_banktransfer_iban_number: bd.iban,
        customers_banktransfer_iban_bankname: '',
      }, oc)
    } catch (err) {
      console.warn('[order] customers IBAN update failed:', err)
    }
  }

  await dbInsert(db, 'orders_status_history', {
    orders_id: orderId, orders_status_id: 1, date_added: now,
    customer_notified: 0, comments: comp.notes ?? '',
  }, oc)

  for (const l of comp.lines) {
    try {
      await dbUpdateExpr(db, 'products', { products_id: l.productId }, 'products_ordered = products_ordered + ?', [l.quantity], oc)
    } catch (err) {
      console.warn(`[order] products_ordered update failed for ${l.productId}:`, err)
    }
  }

  return orderId
}
