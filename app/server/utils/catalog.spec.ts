// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createMockDb } from '../../test/helpers/mock-db'

import { getCatalog, invalidateCatalog } from './catalog'

/**
 * The catalog query is the most expensive read in the shop and identical for
 * every visitor, so it is cached. Three behaviours carry that: a TTL, a
 * single-flight guard so a burst of requests issues one query rather than one
 * each, and serving a stale snapshot when a refresh fails — an outdated catalog
 * beats an unreachable shop.
 */

const CATEGORY_ROWS = [{ categories_id: 1, parent_id: 0, sort_order: 1, categories_name: 'Honig' }]

function baseRow() {
  return {
    products_id: 1,
    products_price: '10.0000',
    products_model: 'HON-1',
    products_image: null as string | null,
    products_image_detail_1: '',
    products_image_detail_2: '',
    products_image_detail_3: '',
    products_image_detail_4: '',
    products_image_detail_5: '',
    products_date_added: null as Date | null,
    tax_rate: '19.0000',
    products_name: 'Honig',
    products_description: null as string | null,
    products_description2: null as string | null,
    products_content: null as string | null,
    products_sizes: null as string | null,
    products_viewed: 0,
    products_head_title_tag: null as string | null,
    products_head_desc_tag: null as string | null,
    products_head_keywords_tag: null as string | null,
    category_id: 1,
    category_name: 'Honig',
  }
}

/** One product row with the columns the catalog query selects. */
function productRow(over: Partial<ReturnType<typeof baseRow>> = {}) {
  return { ...baseRow(), ...over }
}

const PRODUCT_ROWS = [productRow()]

function loadedDb(extra: Parameters<typeof createMockDb>[0] = []) {
  return createMockDb([
    ...extra,
    { match: 'FROM categories', rows: CATEGORY_ROWS },
    { match: 'FROM products', rows: PRODUCT_ROWS },
  ])
}

beforeEach(() => {
  invalidateCatalog()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  invalidateCatalog()
})

describe('getCatalog', () => {
  it('loads and converts the catalog on the first call', async () => {
    const db = loadedDb()

    const snapshot = await getCatalog(db.pool)

    expect(snapshot.products.map((p) => p.name)).toStrictEqual(['Honig'])
    // 10.00 net at 19 % — the conversion runs, not just the query.
    expect(snapshot.products[0].price).toBe(11.9)
    expect(snapshot.categories.map((c) => c.slug)).toStrictEqual(['honig'])
  })

  it('serves the cached snapshot within the TTL', async () => {
    const db = loadedDb()

    await getCatalog(db.pool)
    const queriesAfterFirst = db.calls.length
    await getCatalog(db.pool)

    expect(db.calls).toHaveLength(queriesAfterFirst)
  })

  it('reloads once the TTL has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const db = loadedDb()

    await getCatalog(db.pool)
    const queriesAfterFirst = db.calls.length

    vi.setSystemTime(new Date('2026-01-01T00:01:01Z')) // TTL is 60s
    await getCatalog(db.pool)

    expect(db.calls.length).toBeGreaterThan(queriesAfterFirst)
  })

  it('shares one query between concurrent callers', async () => {
    const db = loadedDb()

    // Three visitors hitting a cold cache must not take three pool slots.
    const [a, b, c] = await Promise.all([
      getCatalog(db.pool),
      getCatalog(db.pool),
      getCatalog(db.pool),
    ])

    expect(db.calls).toHaveLength(2) // categories + products, once
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('propagates the failure when there is nothing cached yet', async () => {
    const db = createMockDb([{ match: 'FROM categories', error: new Error('db down') }])

    await expect(getCatalog(db.pool)).rejects.toThrow('db down')
  })

  it('serves the stale snapshot when a refresh fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const db = loadedDb()
    const first = await getCatalog(db.pool)

    // The database goes away after the first successful load.
    db.stub({ match: 'FROM categories', error: new Error('db down') })
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    const second = await getCatalog(db.pool)

    expect(second).toBe(first)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('serving snapshot from'),
      expect.anything(),
    )
  })

  it('logs a rejection that is not an Error at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const db = loadedDb()
    await getCatalog(db.pool)

    // mysql2 can reject with a plain string from some driver paths.
    db.stub({ match: 'FROM categories', error: 'db down' as unknown as Error })
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    await getCatalog(db.pool)

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('serving snapshot from'), 'db down')
  })

  it('backs off instead of hammering a struggling database', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const db = loadedDb()
    await getCatalog(db.pool)
    db.stub({ match: 'FROM categories', error: new Error('db down') })

    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    await getCatalog(db.pool)
    const afterFailure = db.calls.length

    // Immediately afterwards: no retry, the stale snapshot is served instead.
    vi.setSystemTime(new Date('2026-01-01T00:01:03Z'))
    await getCatalog(db.pool)
    expect(db.calls).toHaveLength(afterFailure)

    // Past the back-off window it tries again.
    vi.setSystemTime(new Date('2026-01-01T00:01:10Z'))
    await getCatalog(db.pool)
    expect(db.calls.length).toBeGreaterThan(afterFailure)
  })

  it('forces a reload after invalidateCatalog', async () => {
    const db = loadedDb()

    await getCatalog(db.pool)
    const queriesAfterFirst = db.calls.length
    invalidateCatalog()
    await getCatalog(db.pool)

    expect(db.calls.length).toBeGreaterThan(queriesAfterFirst)
  })
})

/**
 * The food range is sold elsewhere now. It is dropped here, in the one place
 * the listing, the detail route and the order pipeline all read from, rather
 * than hidden in the storefront — otherwise it would stay reachable via "Alle",
 * a direct category link or the product URL.
 */
describe('hidden categories', () => {
  const CATEGORIES = [
    { categories_id: 1, parent_id: 0, sort_order: 1, categories_name: 'Papeterie' },
    { categories_id: 52, parent_id: 0, sort_order: 2, categories_name: 'Lebensmittel' },
    { categories_id: 54, parent_id: 52, sort_order: 1, categories_name: 'Bulgur' },
  ]
  const PRODUCTS = [
    productRow({ products_id: 1, products_name: 'Karte', category_id: 1 }),
    productRow({ products_id: 2, products_name: 'Salz', category_id: 52 }),
    productRow({ products_id: 3, products_name: 'Bulgur', category_id: 54 }),
    // Same name as the visible product and more views, so it wins the plain
    // "karte" slug during de-duplication — see the slug test below.
    productRow({ products_id: 4, products_name: 'Karte', category_id: 54, products_viewed: 99 }),
  ]

  function db() {
    return createMockDb([
      { match: 'FROM categories', rows: CATEGORIES },
      { match: 'FROM products', rows: PRODUCTS },
    ])
  }

  it('drops the hidden category and everything below it', async () => {
    const snapshot = await getCatalog(db().pool)

    expect(snapshot.categories.map((c) => c.slug)).toStrictEqual(['papeterie'])
  })

  it('drops products of the hidden category and of its children', async () => {
    const snapshot = await getCatalog(db().pool)

    // 'Salz' sits directly in Lebensmittel, 'Bulgur' in its subcategory.
    expect(snapshot.products.map((p) => p.id)).toStrictEqual(['1'])
  })

  it('leaves the slugs of the remaining products untouched', async () => {
    const snapshot = await getCatalog(db().pool)

    // The hidden namesake already took 'karte'. Filtering before the grouping
    // would hand it back and silently break every existing link to 'karte-2'.
    expect(snapshot.products[0].slug).toBe('karte-2')
  })
})
