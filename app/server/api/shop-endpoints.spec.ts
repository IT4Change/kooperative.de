// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../test/setup-server'
import { callHandler } from '../../test/helpers/event'
import { createMockDb } from '../../test/helpers/mock-db'
import { signSession } from '../utils/auth'

import ibanInfoEndpoint from './iban/info.get'
import ordersConfirm from './orders/confirm.post'
import pendingByToken from './orders/pending/[token].get'
import ordersPost from './orders.post'
import productView from './products/[id]/view.post'
import productDetail from './products/[id].get'
import productList from './products.get'

import type { Category, Product } from '~/data/products'

const getCatalog = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/catalog'), () => ({ getCatalog }))

const dbUpdateExpr = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/dbWrite'), () => ({ dbUpdateExpr }))

const computeOrder = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/orderCompute'), () => ({ computeOrder }))

const createPendingOrder = vi.hoisted(() => vi.fn())
const getPendingByToken = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/pendingOrder'), () => ({ createPendingOrder, getPendingByToken }))

const confirmPending = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/pendingConfirm'), () => ({ confirmPending }))

const sendAndLogOrderMail = vi.hoisted(() => vi.fn())
vi.mock(import('../utils/orderMailLog'), () => ({ sendAndLogOrderMail }))

/** The customer-facing shop endpoints. */
function product(over: Partial<Product> = {}): Product {
  return {
    id: '1',
    name: 'Honig',
    price: 11.9,
    description: 'Honig aus der Region',
    category: 'lebensmittel',
    images: [],
    slug: 'honig',
    content: 'Langtext',
    details: 'Details',
    metaTitle: 'Titel',
    metaDescription: 'Beschreibung',
    metaKeywords: 'a,b',
    ...over,
  }
}

const CATEGORIES: Category[] = [
  { slug: 'lebensmittel', name: 'Lebensmittel', description: '', parentSlug: null },
  { slug: 'lebensmittel/oele', name: 'Öle', description: '', parentSlug: 'lebensmittel' },
  { slug: 'papeterie', name: 'Papeterie', description: '', parentSlug: null },
]

const COMP = {
  customer: { customerId: 3, email: 'kundin@example.org', name: 'Erika Musterfrau' },
  lines: [{ name: 'Honig', quantity: 2, unitGross: 11.9, lineGross: 23.8 }],
  subtotalGross: 23.8,
  shipping: { module: 'Abholung', gross: 0 },
  taxRows: [{ description: 'Mehrwertsteuer', total: 3.8004 }],
  payment: { label: 'Bezahlung mit Vorkasse' },
  total: 23.8,
}

function useMockDb(stubs: Parameters<typeof createMockDb>[0] = []) {
  const db = createMockDb(stubs)
  globalThis.useDB = (() => db.pool) as never
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  useMockDb()
  getCatalog.mockResolvedValue({ products: [product()], categories: CATEGORIES })
  computeOrder.mockResolvedValue(COMP)
  createPendingOrder.mockResolvedValue({ id: 12, token: 'tok' })
  confirmPending.mockResolvedValue({ ordersId: 55, alreadyDone: false })
  sendAndLogOrderMail.mockResolvedValue({ status: 'sent', errorMessage: null })
})

describe('GET /api/products', () => {
  it('strips the long-form and meta text from the listing', async () => {
    const result = await callHandler<{ products: Record<string, unknown>[] }>(productList)

    // The listing already carries the whole catalogue; this text is dead weight.
    expect(result.products[0]).not.toHaveProperty('content')
    expect(result.products[0]).not.toHaveProperty('metaDescription')
    expect(result.products[0]).toMatchObject({ id: '1', name: 'Honig', price: 11.9 })
  })

  it('drops categories that hold no products', async () => {
    const result = await callHandler<{ categories: Category[] }>(productList)

    expect(result.categories.map((c) => c.slug)).toStrictEqual(['lebensmittel'])
  })

  it('keeps a parent category whose child holds the products', async () => {
    getCatalog.mockResolvedValue({
      products: [product({ category: 'lebensmittel/oele' })],
      categories: CATEGORIES,
    })

    const result = await callHandler<{ categories: Category[] }>(productList)

    // Otherwise the filter would show a child with no way to reach it.
    expect(result.categories.map((c) => c.slug)).toStrictEqual([
      'lebensmittel',
      'lebensmittel/oele',
    ])
  })
})

describe('GET /api/products/[id]', () => {
  it('finds a product by its osCommerce id', async () => {
    const result = await callHandler<{ product: Product; categoryName: string }>(productDetail, {
      params: { id: '1' },
    })

    expect(result.product.name).toBe('Honig')
    expect(result.categoryName).toBe('Lebensmittel')
  })

  it('finds the same product by its slug', async () => {
    // Both URL shapes exist: /shop/747 and /shop/bad-reiniger.
    const result = await callHandler<{ product: Product }>(productDetail, {
      params: { id: 'honig' },
    })

    expect(result.product.id).toBe('1')
  })

  it('keeps the long-form text that the listing drops', async () => {
    const result = await callHandler<{ product: Product }>(productDetail, { params: { id: '1' } })

    expect(result.product.content).toBe('Langtext')
  })

  it('falls back to the slug when the category has no name', async () => {
    getCatalog.mockResolvedValue({ products: [product({ category: 'unbekannt' })], categories: [] })

    const result = await callHandler<{ categoryName: string }>(productDetail, {
      params: { id: '1' },
    })

    expect(result.categoryName).toBe('unbekannt')
  })

  it('answers 400 without a reference', async () => {
    await expect(callHandler(productDetail, { params: {} })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('answers 404 for an unknown product', async () => {
    await expect(callHandler(productDetail, { params: { id: '999' } })).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('POST /api/products/[id]/view', () => {
  it('counts the view on the German description row', async () => {
    const result = await callHandler(productView, { method: 'POST', params: { id: '1' } })

    expect(result).toStrictEqual({ ok: true, affected: undefined })
    expect(dbUpdateExpr).toHaveBeenCalledWith(
      expect.anything(),
      'products_description',
      { products_id: 1, language_id: 2 },
      'products_viewed = products_viewed + 1',
      [],
      expect.anything(),
    )
  })

  it.each([['abc'], ['']])('rejects the non-numeric id %j', async (id) => {
    await expect(
      callHandler(productView, { method: 'POST', params: { id } }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('swallows a failure — a view counter must not break the page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    dbUpdateExpr.mockRejectedValue(new Error('table locked'))

    await expect(
      callHandler(productView, { method: 'POST', params: { id: '1' } }),
    ).resolves.toStrictEqual({
      ok: false,
    })
    expect(warn).toHaveBeenCalled()
  })
})

describe('GET /api/iban/info', () => {
  it('resolves a German IBAN to its bank', async () => {
    const result = await callHandler<{ ok: boolean; blz: string; valid: boolean }>(
      ibanInfoEndpoint,
      { url: '/api/iban/info?iban=DE89%203704%200044%200532%200130%2000' },
    )

    expect(result).toMatchObject({ ok: true, blz: '37040044', valid: true })
  })

  it('reports an invalid IBAN as such', async () => {
    const result = await callHandler<{ valid: boolean }>(ibanInfoEndpoint, {
      url: '/api/iban/info?iban=DE00000000000000000000',
    })

    expect(result.valid).toBe(false)
  })

  it('answers politely when nothing was passed', async () => {
    await expect(callHandler(ibanInfoEndpoint, { url: '/api/iban/info' })).resolves.toStrictEqual({
      ok: false,
    })
  })
})

describe('POST /api/orders', () => {
  const ORDER = {
    items: [{ productId: '1', quantity: 2 }],
    shippingMethod: 'abholung',
    paymentMethod: 'vorkasse',
  }
  const cookie = () => `koop_session=${signSession({ customerId: 3, email: 'kundin@example.org' })}`

  it('parks the order as pending and reports its id', async () => {
    const result = await callHandler(ordersPost, {
      method: 'POST',
      body: ORDER,
      headers: { cookie: cookie() },
    })

    expect(result).toStrictEqual({ ok: true, pendingId: 12, total: 23.8 })
    // Nothing is written to the osCommerce tables before the customer confirms.
    expect(createPendingOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: 3, email: 'kundin@example.org', total: 23.8 }),
      expect.anything(),
    )
  })

  it('mails the customer and the operator', async () => {
    await callHandler(ordersPost, { method: 'POST', body: ORDER, headers: { cookie: cookie() } })

    expect(sendAndLogOrderMail).toHaveBeenCalledTimes(2)
    const directions = sendAndLogOrderMail.mock.calls.map(([, m]) => m.direction as string)
    expect(directions).toStrictEqual(['to_customer', 'to_admin'])
  })

  it('lets the operator reply straight to the customer', async () => {
    await callHandler(ordersPost, { method: 'POST', body: ORDER, headers: { cookie: cookie() } })

    expect(sendAndLogOrderMail.mock.calls[1][1].replyTo).toBe('kundin@example.org')
  })

  it('refuses an anonymous checkout', async () => {
    await expect(callHandler(ordersPost, { method: 'POST', body: ORDER })).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(computeOrder).not.toHaveBeenCalled()
  })

  it('rejects an invalid cart before computing anything', async () => {
    await expect(
      callHandler(ordersPost, {
        method: 'POST',
        body: { ...ORDER, items: [] },
        headers: { cookie: cookie() },
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(computeOrder).not.toHaveBeenCalled()
  })
})

describe('GET /api/orders/pending/[token]', () => {
  const PENDING = { status: 'pending', ordersId: null, payload: { comp: COMP } }

  it('returns the pinned content for the review page', async () => {
    getPendingByToken.mockResolvedValue(PENDING)

    const result = await callHandler<Record<string, unknown>>(pendingByToken, {
      params: { token: 'tok' },
    })

    expect(result).toMatchObject({
      status: 'pending',
      customer: { name: 'Erika Musterfrau' },
      subtotal: 23.8,
      payment: 'Bezahlung mit Vorkasse',
      total: 23.8,
    })
    expect(result.items).toStrictEqual([
      { name: 'Honig', quantity: 2, unitPrice: 11.9, lineTotal: 23.8 },
    ])
  })

  it('rounds the tax rows to cents', async () => {
    getPendingByToken.mockResolvedValue(PENDING)

    const result = await callHandler<{ taxRows: { total: number }[] }>(pendingByToken, {
      params: { token: 'tok' },
    })

    expect(result.taxRows[0].total).toBe(3.8)
  })

  it('answers 400 when the route carries no token at all', async () => {
    await expect(callHandler(pendingByToken)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('answers 400 without a token', async () => {
    await expect(callHandler(pendingByToken, { params: { token: '  ' } })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it.each([
    ['an unknown token', null],
    ['a record whose payload is unreadable', { payload: { comp: null } }],
  ])('answers 404 for %s', async (_label, value) => {
    getPendingByToken.mockResolvedValue(value)

    await expect(callHandler(pendingByToken, { params: { token: 'tok' } })).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('POST /api/orders/confirm', () => {
  it('confirms the order behind the token', async () => {
    getPendingByToken.mockResolvedValue({ id: 12 })

    const result = await callHandler(ordersConfirm, { method: 'POST', body: { token: 'tok' } })

    expect(result).toStrictEqual({ ok: true, orderId: 55, alreadyConfirmed: false })
    expect(confirmPending).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { id: 12 },
      'link',
      expect.anything(),
    )
  })

  it('reports a repeated confirmation as already done', async () => {
    getPendingByToken.mockResolvedValue({ id: 12 })
    confirmPending.mockResolvedValue({ ordersId: 55, alreadyDone: true })

    const result = await callHandler<{ alreadyConfirmed: boolean }>(ordersConfirm, {
      method: 'POST',
      body: { token: 'tok' },
    })

    expect(result.alreadyConfirmed).toBe(true)
  })

  it.each([
    ['an empty token', { token: '   ' }],
    ['no token at all', {}],
  ])('answers 400 for %s', async (_label, body) => {
    await expect(callHandler(ordersConfirm, { method: 'POST', body })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('answers 404 for a token nobody knows', async () => {
    getPendingByToken.mockResolvedValue(null)

    await expect(
      callHandler(ordersConfirm, { method: 'POST', body: { token: 'tok' } }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
