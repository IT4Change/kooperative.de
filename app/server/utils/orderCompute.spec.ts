// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../test/setup-server'
import { createMockDb } from '../../test/helpers/mock-db'

import { computeOrder, insertComputedOrder } from './orderCompute'

import type { OrderComputation } from './orderCompute'
import type { Product } from '~/data/products'

const getCatalog = vi.hoisted(() => vi.fn())
vi.mock(import('./catalog'), () => ({ getCatalog }))

const dbInsert = vi.hoisted(() => vi.fn())
const dbUpdate = vi.hoisted(() => vi.fn())
const dbUpdateExpr = vi.hoisted(() => vi.fn())
vi.mock(import('./dbWrite'), () => ({ dbInsert, dbUpdate, dbUpdateExpr }))

/**
 * The money lives here: this module turns a cart plus the current database state
 * into the prices that get charged, and then writes them into the osCommerce
 * tables. Both halves are pinned — the arithmetic, and the exact rows the legacy
 * admin later reads back.
 */

const CUSTOMER_ROW = {
  customers_id: 3,
  customers_firstname: 'Erika',
  customers_lastname: 'Musterfrau',
  customers_email_address: 'e@example.org',
  customers_telephone: '0711',
  entry_company: null,
  entry_street_address: 'Im Winkel 11',
  entry_suburb: null,
  entry_postcode: '88422',
  entry_city: 'Dürnau',
  entry_state: null,
  entry_country_id: 81,
}

/** DECIMAL columns arrive from mysql2 as strings — the fixtures mirror that. */
function productRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    products_id: 1,
    products_model: 'HON-1',
    products_price: '10.0000',
    products_name: 'Honig',
    products_tax_class_id: 2,
    tax_rate: '19.0000',
    tax_description: 'Mehrwertsteuer',
    ...over,
  }
}

function dbFor(
  products: Record<string, unknown>[],
  extra: Parameters<typeof createMockDb>[0] = [],
) {
  return createMockDb([
    ...extra,
    { match: 'FROM customers c', rows: [CUSTOMER_ROW] },
    { match: 'zones_to_geo_zones', rows: [{ geo_zone_id: 2 }] },
    { match: 'FROM products p', rows: products },
  ])
}

beforeEach(() => {
  vi.clearAllMocks()
  getCatalog.mockResolvedValue({ products: [], categories: [] })
})

describe('computeOrder', () => {
  it('turns the net price into the gross price the customer is charged', async () => {
    const db = dbFor([productRow()])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 2 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    // 10.00 net at 19 % = 11.90 each, twice = 23.80
    expect(comp.lines).toHaveLength(1)
    expect(comp.lines[0]).toMatchObject({ unitGross: 11.9, lineGross: 23.8, tax: 19, quantity: 2 })
    expect(comp.subtotalGross).toBe(23.8)
    // Abholung has no fixed price, so the total is the goods alone.
    expect(comp.total).toBe(23.8)
  })

  it('adds the gross shipping cost on top', async () => {
    const db = dbFor([productRow()], [{ match: 'FROM tax_rates', rows: [] }])
    db.stub({
      match: 'tax_class_id = ? AND tax_zone_id',
      rows: [{ tax_rate: '19.0000', tax_description: 'Mehrwertsteuer' }],
    })

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'dpd',
      paymentMethod: 'vorkasse',
    })

    // 6.3025 net → 7.50 gross, on top of 11.90
    expect(comp.shipping.gross).toBe(7.5)
    expect(comp.shipping.totalTitle).toBe('Versand mit DPD:')
    expect(comp.total).toBe(19.4)
  })

  it('accumulates the tax of goods and shipping under one description', async () => {
    const db = dbFor([productRow()])
    db.stub({
      match: 'tax_class_id = ? AND tax_zone_id',
      rows: [{ tax_rate: '19.0000', tax_description: 'Mehrwertsteuer' }],
    })

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'dpd',
      paymentMethod: 'vorkasse',
    })

    expect(comp.taxRows).toHaveLength(1)
    expect(comp.taxRows[0].description).toBe('Mehrwertsteuer')
    // 19 % share of 11.90 plus of 7.50
    expect(comp.taxRows[0].total).toBeCloseTo(3.1, 2)
  })

  it('keeps different tax rates apart and sorts them by first appearance', async () => {
    const db = dbFor([
      productRow(),
      productRow({
        products_id: 2,
        products_name: 'Brot',
        products_price: '3.0000',
        products_tax_class_id: 3,
        tax_rate: '7.0000',
        tax_description: 'Mehrwertsteuer ermäßigt',
      }),
    ])

    const comp = await computeOrder(db.pool, 3, {
      items: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    expect(comp.taxRows.map((t) => t.description)).toStrictEqual([
      'Mehrwertsteuer',
      'Mehrwertsteuer ermäßigt',
    ])
    // 11.90 + 3.21
    expect(comp.subtotalGross).toBe(15.11)
  })

  it('leaves an untaxed product out of the tax rows', async () => {
    const db = dbFor([productRow({ tax_rate: null, tax_description: null })])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    expect(comp.taxRows).toStrictEqual([])
    expect(comp.lines[0].unitGross).toBe(10)
  })

  it('resolves a size variant to the concrete product behind it', async () => {
    getCatalog.mockResolvedValue({
      products: [
        {
          id: '1',
          variants: [{ productId: '1' }, { productId: '9' }],
        } as unknown as Product,
      ],
      categories: [],
    })
    const db = dbFor([
      productRow({ products_id: 9, products_name: 'Olivenöl 1 Liter', products_price: '15.0000' }),
    ])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1, variantIndex: 1 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    // The variant's own price, not the group's base price.
    expect(comp.lines[0]).toMatchObject({ productId: 9, name: 'Olivenöl 1 Liter' })
    expect(comp.lines[0].unitGross).toBe(17.85)
  })

  it('picks the quantity tier that matches the ordered amount', async () => {
    getCatalog.mockResolvedValue({
      products: [
        {
          id: '1',
          variantType: 'quantity',
          variants: [
            { productId: '1', minQty: 1 },
            { productId: '9', minQty: 10 },
          ],
        } as unknown as Product,
      ],
      categories: [],
    })
    const db = dbFor([productRow({ products_id: 9, products_price: '1.5000' })])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 10 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    expect(comp.lines[0].productId).toBe(9)
    // 1.50 net → 1.79 gross, ten of them
    expect(comp.lines[0].lineGross).toBe(17.9)
  })

  it('clamps a variant index that is out of range', async () => {
    getCatalog.mockResolvedValue({
      products: [
        { id: '1', variants: [{ productId: '1' }, { productId: '9' }] } as unknown as Product,
      ],
      categories: [],
    })
    const db = dbFor([productRow({ products_id: 9 })])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1, variantIndex: 99 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    expect(comp.lines[0].productId).toBe(9)
  })

  it('carries the customer and their delivery address into the computation', async () => {
    const db = dbFor([productRow()])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'abholung',
      paymentMethod: 'rechnung',
      notes: 'Bitte klingeln',
      bankDetails: { accountHolder: 'Erika', iban: 'DE89370400440532013000' },
    })

    expect(comp.customer).toMatchObject({
      customerId: 3,
      name: 'Erika Musterfrau',
      street: 'Im Winkel 11',
      city: 'Dürnau',
      country: 'Deutschland',
    })
    expect(comp.payment).toStrictEqual({ label: 'Bezahlung mit Rechnung', method: 'rechnung' })
    expect(comp.notes).toBe('Bitte klingeln')
    expect(comp.bankDetails).toStrictEqual({
      accountHolder: 'Erika',
      iban: 'DE89370400440532013000',
    })
  })

  it('rejects an order for a customer without a complete address', async () => {
    const db = createMockDb([{ match: 'FROM customers c', rows: [] }])

    await expect(
      computeOrder(db.pool, 3, {
        items: [{ productId: 1, quantity: 1 }],
        shippingMethod: 'abholung',
        paymentMethod: 'vorkasse',
      }),
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Kundendaten unvollständig' })
  })

  it('rejects an order containing a product that is no longer available', async () => {
    // The product query returns nothing for the requested id.
    const db = dbFor([])

    await expect(
      computeOrder(db.pool, 3, {
        items: [{ productId: 77, quantity: 1 }],
        shippingMethod: 'abholung',
        paymentMethod: 'vorkasse',
      }),
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Artikel 77 nicht verfügbar' })
  })

  it('charges shipping untaxed when the country has no tax zone', async () => {
    const db = createMockDb([
      { match: 'FROM customers c', rows: [CUSTOMER_ROW] },
      { match: 'zones_to_geo_zones', rows: [] },
      { match: 'FROM products p', rows: [productRow({ tax_rate: null, tax_description: null })] },
    ])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'dpd',
      paymentMethod: 'vorkasse',
    })

    // The shipping module has a tax class, but without a zone there is no rate —
    // so the customer is charged the net 6.30 instead of the advertised 7.50.
    expect(comp.shipping.gross).toBe(6.3)
    expect(comp.taxRows).toStrictEqual([])
  })

  it('charges shipping untaxed when the tax class has no rate on file', async () => {
    const db = dbFor([productRow({ tax_rate: null, tax_description: null })])
    db.stub({ match: 'tax_class_id = ? AND tax_zone_id', rows: [] })

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'dpd',
      paymentMethod: 'vorkasse',
    })

    expect(comp.taxRows).toStrictEqual([])
  })

  it('names an unnamed shipping tax rate', async () => {
    const db = dbFor([productRow({ tax_rate: null, tax_description: null })])
    db.stub({
      match: 'tax_class_id = ? AND tax_zone_id',
      rows: [{ tax_rate: '19.0000', tax_description: null }],
    })

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'dpd',
      paymentMethod: 'vorkasse',
    })

    // The row goes into orders_total, where an empty title would look like a bug.
    expect(comp.taxRows).toHaveLength(1)
    expect(comp.taxRows[0].description).toBe('Mehrwertsteuer')
  })

  it('opens a tax row for shipping when the goods carry no tax', async () => {
    const db = dbFor([productRow({ tax_rate: null, tax_description: null })])
    db.stub({
      match: 'tax_class_id = ? AND tax_zone_id',
      rows: [{ tax_rate: '19.0000', tax_description: 'Mehrwertsteuer' }],
    })

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'dpd',
      paymentMethod: 'vorkasse',
    })

    // 7.50 gross contains 1.20 of tax; it sorts last, after any goods rows.
    expect(comp.taxRows).toHaveLength(1)
    expect(comp.taxRows[0]).toMatchObject({ description: 'Mehrwertsteuer', sortOrder: 99 })
    expect(comp.taxRows[0].total).toBeCloseTo(1.2, 2)
  })

  it('takes the first variant when the cart names none', async () => {
    getCatalog.mockResolvedValue({
      products: [
        {
          id: '1',
          variants: [{ productId: '11' }, { productId: '12' }],
        } as unknown as Product,
      ],
      categories: [],
    })
    const db = dbFor([productRow({ products_id: 11 })])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    expect(comp.lines[0].productId).toBe(11)
  })

  it('stays on the base tier below the next threshold', async () => {
    getCatalog.mockResolvedValue({
      products: [
        {
          id: '1',
          variantType: 'quantity',
          variants: [
            { productId: '11', minQty: 1 },
            { productId: '12', minQty: 10 },
          ],
        } as unknown as Product,
      ],
      categories: [],
    })
    const db = dbFor([productRow({ products_id: 11 })])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 5 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    // Five pieces do not reach the 10+ tier, so the base row is charged.
    expect(comp.lines[0].productId).toBe(11)
  })

  it('keeps the ordered product when the variant carries no id of its own', async () => {
    getCatalog.mockResolvedValue({
      products: [{ id: '1', variants: [{ size: '1 L' }] } as unknown as Product],
      categories: [],
    })
    const db = dbFor([productRow()])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1, variantIndex: 0 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    // A catalogue entry without a product id behind the variant must not turn
    // the order into one for product NaN.
    expect(comp.lines[0].productId).toBe(1)
  })

  it('accepts a product and a customer whose optional columns are empty', async () => {
    const db = createMockDb([
      {
        match: 'FROM customers c',
        rows: [
          {
            ...CUSTOMER_ROW,
            customers_firstname: null,
            customers_lastname: null,
            customers_telephone: null,
            customers_email_address: null,
          },
        ],
      },
      { match: 'zones_to_geo_zones', rows: [{ geo_zone_id: 2 }] },
      { match: 'FROM products p', rows: [productRow({ products_model: null })] },
    ])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    expect(comp.customer).toMatchObject({
      firstname: '',
      lastname: '',
      telephone: '',
      email: '',
    })
    expect(comp.lines[0].model).toBe('')
  })

  it('falls back to no tax zone for a country that has none', async () => {
    const db = createMockDb([
      { match: 'FROM customers c', rows: [CUSTOMER_ROW] },
      { match: 'zones_to_geo_zones', rows: [] },
      { match: 'FROM products p', rows: [productRow({ tax_rate: null, tax_description: null })] },
    ])

    const comp = await computeOrder(db.pool, 3, {
      items: [{ productId: 1, quantity: 1 }],
      shippingMethod: 'abholung',
      paymentMethod: 'vorkasse',
    })

    // Without a zone the join finds no rate: the net price is charged as is.
    expect(comp.lines[0].unitGross).toBe(10)
    expect(db.sql(2)).toContain('tr.tax_zone_id IS NULL')
  })
})

describe('insertComputedOrder', () => {
  const COMP: OrderComputation = {
    customer: {
      customerId: 3,
      firstname: 'Erika',
      lastname: 'Musterfrau',
      name: 'Erika Musterfrau',
      company: null,
      street: 'Im Winkel 11',
      suburb: null,
      city: 'Dürnau',
      postcode: '88422',
      state: null,
      country: 'Deutschland',
      telephone: '0711',
      email: 'e@example.org',
    },
    lines: [
      {
        productId: 1,
        model: 'HON-1',
        name: 'Honig',
        priceNet: 10,
        unitGross: 11.9,
        tax: 19,
        quantity: 2,
        lineGross: 23.8,
      },
    ],
    subtotalGross: 23.8,
    taxRows: [{ description: 'Mehrwertsteuer', rate: 19, total: 3.8, sortOrder: 0 }],
    shipping: { module: 'Abholung', totalTitle: 'Abholung:', gross: 0 },
    payment: { label: 'Bezahlung mit Vorkasse', method: 'vorkasse' },
    total: 23.8,
  }

  /** Collects the rows written per table, which is what the legacy admin reads. */
  function written() {
    const byTable: Record<string, Record<string, unknown>[]> = {}
    for (const call of dbInsert.mock.calls) {
      const [, table, fields] = call as [unknown, string, Record<string, unknown>]
      ;(byTable[table] ??= []).push(fields)
    }
    return byTable
  }

  beforeEach(() => {
    dbInsert.mockResolvedValue(55)
  })

  it('writes the order header with the customer as delivery and billing address', async () => {
    const db = createMockDb()

    const orderId = await insertComputedOrder(db.pool, COMP, { remoteIp: '10.0.0.1' })

    expect(orderId).toBe(55)
    const [order] = written().orders
    expect(order).toMatchObject({
      customers_id: 3,
      customers_name: 'Erika Musterfrau',
      delivery_name: 'Erika Musterfrau',
      billing_name: 'Erika Musterfrau',
      payment_method: 'Bezahlung mit Vorkasse',
      orders_status: 1,
      currency: 'EUR',
    })
  })

  it('writes one row per order line with the unit gross price', async () => {
    const db = createMockDb()

    await insertComputedOrder(db.pool, COMP)

    const [line] = written().orders_products
    expect(line).toMatchObject({
      orders_id: 55,
      products_id: 1,
      products_name: 'Honig',
      products_price: 10,
      products_quantity: 2,
      products_tax: 19,
    })
    // final_price is per piece, not per line.
    expect(line.final_price).toBe(11.9)
  })

  it('writes subtotal, tax and total in the order the old shop expects', async () => {
    const db = createMockDb()

    await insertComputedOrder(db.pool, COMP)

    const totals = written().orders_total
    // The shipping line is written even at zero — that is how the old shop
    // rendered "Abholung: 0,00 EURO".
    expect(totals.map((t) => [t.class, t.value, t.sort_order])).toStrictEqual([
      ['ot_subtotal', 23.8, 1],
      ['ot_shipping', 0, 2],
      ['ot_tax', 3.8, 3],
      ['ot_total', 23.8, 4],
    ])
    // The legacy templates render `text`, so its formatting is part of the contract.
    expect(totals[0].text).toBe('23,80&nbsp;EURO')
    expect(totals[1].title).toBe('Abholung:')
    expect(totals[3].text).toBe('<b>23,80&nbsp;EURO</b>')
  })

  it('omits a tax row that rounds to zero', async () => {
    const db = createMockDb()

    await insertComputedOrder(db.pool, {
      ...COMP,
      taxRows: [{ description: 'Mehrwertsteuer', rate: 19, total: 0.001, sortOrder: 0 }],
    })

    expect(written().orders_total.map((t) => t.class)).toStrictEqual([
      'ot_subtotal',
      'ot_shipping',
      'ot_total',
    ])
  })

  it('opens the status history at "In Bearbeitung" with the customer note', async () => {
    const db = createMockDb()

    await insertComputedOrder(db.pool, { ...COMP, notes: 'Bitte klingeln' })

    expect(written().orders_status_history[0]).toMatchObject({
      orders_id: 55,
      orders_status_id: 1,
      customer_notified: 0,
      comments: 'Bitte klingeln',
    })
  })

  it('counts the ordered quantity onto the product', async () => {
    const db = createMockDb()

    await insertComputedOrder(db.pool, COMP)

    expect(dbUpdateExpr).toHaveBeenCalledWith(
      db.pool,
      'products',
      { products_id: 1 },
      'products_ordered = products_ordered + ?',
      [2],
      expect.objectContaining({ orderId: 55 }),
    )
  })

  it('stores the bank details for a direct debit order', async () => {
    const db = createMockDb()

    await insertComputedOrder(db.pool, {
      ...COMP,
      payment: { label: 'Lastschriftverfahren IBAN (DE)', method: 'lastschrift' },
      bankDetails: { accountHolder: 'Erika Musterfrau', iban: 'DE89370400440532013000' },
    })

    expect(written().banktransfer_iban[0]).toMatchObject({
      orders_id: 55,
      banktransfer_owner: 'Erika Musterfrau',
      banktransfer_number: 'DE89370400440532013000',
    })
    expect(dbUpdate).toHaveBeenCalledWith(
      db.pool,
      'customers',
      { customers_id: 3 },
      expect.objectContaining({ customers_banktransfer_iban_number: 'DE89370400440532013000' }),
      expect.anything(),
    )
  })

  it('writes no bank details for any other payment method', async () => {
    const db = createMockDb()

    await insertComputedOrder(db.pool, COMP)

    expect(written().banktransfer_iban).toBeUndefined()
    expect(dbUpdate).not.toHaveBeenCalled()
  })

  it('still returns the order when the optional follow-up writes fail', async () => {
    const db = createMockDb()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    dbUpdate.mockRejectedValue(new Error('customers locked'))
    dbUpdateExpr.mockRejectedValue(new Error('products locked'))

    const orderId = await insertComputedOrder(db.pool, {
      ...COMP,
      payment: { label: 'Lastschriftverfahren IBAN (DE)', method: 'lastschrift' },
      bankDetails: { accountHolder: 'Erika', iban: 'DE89370400440532013000' },
    })

    // The order itself is what counts — a locked side table must not lose it.
    expect(orderId).toBe(55)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
