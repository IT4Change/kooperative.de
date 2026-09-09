// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { buildCategoryPaths, convertCategory, groupProducts } from './converter'

import type { DbCategory, DbProduct } from './converter'

function category(overrides: Partial<DbCategory> & { categories_id: number }): DbCategory {
  return {
    categories_name: `Kategorie ${overrides.categories_id}`,
    parent_id: 0,
    sort_order: null,
    ...overrides,
  }
}

/** DECIMAL columns arrive as strings from mysql2 — the fixtures mirror that. */
function product(overrides: Partial<DbProduct> & { products_id: number }): DbProduct {
  return {
    products_price: '10.0000',
    products_model: null,
    products_image: null,
    products_image_detail_1: '',
    products_image_detail_2: '',
    products_image_detail_3: '',
    products_image_detail_4: '',
    products_image_detail_5: '',
    products_date_added: null,
    tax_rate: '0.0000',
    products_name: `Produkt ${overrides.products_id}`,
    products_description: null,
    products_description2: null,
    products_content: null,
    products_sizes: null,
    products_viewed: 0,
    products_head_title_tag: null,
    products_head_desc_tag: null,
    products_head_keywords_tag: null,
    category_id: 1,
    category_name: 'Lebensmittel',
    ...overrides,
  }
}

describe('buildCategoryPaths', () => {
  it('slugifies a top-level category and reports no parent', () => {
    const paths = buildCategoryPaths([category({ categories_id: 1, categories_name: 'Bücher' })])
    expect(paths.get(1)).toStrictEqual({ slug: 'buecher', parentSlug: null })
  })

  it('prefixes a child with its parent path', () => {
    const paths = buildCategoryPaths([
      category({ categories_id: 1, categories_name: 'Papeterie' }),
      category({ categories_id: 2, categories_name: 'Bücher', parent_id: 1 }),
    ])
    expect(paths.get(2)).toStrictEqual({ slug: 'papeterie/buecher', parentSlug: 'papeterie' })
  })

  it('disambiguates same-named categories via their parent path', () => {
    const paths = buildCategoryPaths([
      category({ categories_id: 1, categories_name: 'Bücher' }),
      category({ categories_id: 2, categories_name: 'Papeterie' }),
      category({ categories_id: 3, categories_name: 'Bücher', parent_id: 2 }),
    ])
    expect(paths.get(1)?.slug).toBe('buecher')
    expect(paths.get(3)?.slug).toBe('papeterie/buecher')
  })

  it('walks a three-level chain', () => {
    const paths = buildCategoryPaths([
      category({ categories_id: 1, categories_name: 'Haus' }),
      category({ categories_id: 2, categories_name: 'Küche', parent_id: 1 }),
      category({ categories_id: 3, categories_name: 'Töpfe', parent_id: 2 }),
    ])
    expect(paths.get(3)).toStrictEqual({ slug: 'haus/kueche/toepfe', parentSlug: 'haus/kueche' })
  })

  it('falls back to the bare slug when the parent row is missing', () => {
    const paths = buildCategoryPaths([
      category({ categories_id: 5, categories_name: 'Waise', parent_id: 99 }),
    ])
    expect(paths.get(5)).toStrictEqual({ slug: 'waise', parentSlug: null })
  })

  it('transliterates umlauts and ß and collapses separators', () => {
    const paths = buildCategoryPaths([
      category({ categories_id: 1, categories_name: 'Öl & Süßes — für Größe' }),
    ])
    expect(paths.get(1)?.slug).toBe('oel-suesses-fuer-groesse')
  })
})

describe('convertCategory', () => {
  it('uses the resolved path when one exists', () => {
    const row = category({ categories_id: 2, categories_name: 'Bücher', parent_id: 1 })
    const paths = buildCategoryPaths([
      category({ categories_id: 1, categories_name: 'Papeterie' }),
      row,
    ])
    expect(convertCategory(row, paths)).toStrictEqual({
      slug: 'papeterie/buecher',
      name: 'Bücher',
      description: '',
      parentSlug: 'papeterie',
    })
  })

  it('falls back to a bare slug when no path was built', () => {
    const row = category({ categories_id: 7, categories_name: 'Neu Hier' })
    expect(convertCategory(row, new Map())).toStrictEqual({
      slug: 'neu-hier',
      name: 'Neu Hier',
      description: '',
      parentSlug: null,
    })
  })
})

describe('groupProducts', () => {
  const paths = buildCategoryPaths([
    category({ categories_id: 1, categories_name: 'Lebensmittel' }),
  ])

  it('converts a standalone product and applies the tax rate to the net price', () => {
    const [p] = groupProducts(
      [
        product({
          products_id: 1,
          products_name: 'Honig',
          products_price: '10.0000',
          tax_rate: '19.0000',
        }),
      ],
      paths,
    )
    expect(p).toMatchObject({
      id: '1',
      name: 'Honig',
      price: 11.9,
      category: 'lebensmittel',
      slug: 'honig',
    })
  })

  it('merges size variants of the same base name into one product', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Olivenöl 0,5 Liter' }),
        product({ products_id: 2, products_name: 'Olivenöl 1 Liter' }),
      ],
      paths,
    )
    expect(products).toHaveLength(1)
    expect(products[0].name).toBe('Olivenöl')
    expect(products[0].variants?.map((v) => v.size)).toStrictEqual(['0,5 L', '1 L'])
  })

  it('sorts size variants by their reference amount, not by row order', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Saft 1 Liter' }),
        product({ products_id: 2, products_name: 'Saft 500 ml' }),
      ],
      paths,
    )
    expect(products[0].variants?.map((v) => v.amount)).toStrictEqual([0.5, 1])
  })

  it('normalizes g/ml to the base unit for comparison but keeps the label as written', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Mehl 450 g' }),
        product({ products_id: 2, products_name: 'Mehl 1 kg' }),
      ],
      paths,
    )
    expect(products[0].variants?.map((v) => [v.size, v.amount, v.referenceUnit])).toStrictEqual([
      ['450 g', 0.45, 'kg'],
      ['1 kg', 1, 'kg'],
    ])
  })

  it('treats "N+" suffixes as quantity tiers and sorts them by minQty', () => {
    const products = groupProducts(
      [
        product({ products_id: 2, products_name: 'Karte 50+' }),
        product({ products_id: 1, products_name: 'Karte 10+' }),
      ],
      paths,
    )
    expect(products[0].variantType).toBe('quantity')
    expect(products[0].variants?.map((v) => v.minQty)).toStrictEqual([10, 50])
  })

  it('pulls a suffix-free base row into its variant group as the single-unit tier', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Karte' }),
        product({ products_id: 2, products_name: 'Karte 10+' }),
      ],
      paths,
    )
    expect(products).toHaveLength(1)
    expect(products[0].variants?.map((v) => [v.size, v.minQty])).toStrictEqual([
      ['1 Stk.', 1],
      ['ab 10 Stk.', 10],
    ])
  })

  it('takes the base image as fallback for variants without their own image', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Saft 1 Liter', products_image: 'saft.jpg' }),
        product({ products_id: 2, products_name: 'Saft 2 Liter' }),
      ],
      paths,
    )
    const expected = 'https://shop.kooperative.de/images/saft.jpg'
    expect(products[0].images).toStrictEqual([expected])
    expect(products[0].variants?.every((v) => v.image === expected)).toBe(true)
  })

  it('strips HTML and entities from the description', () => {
    const [p] = groupProducts(
      [
        product({
          products_id: 1,
          products_description: '<p>Fein &amp; s&uuml;&szlig;</p><br>  Zwei   Zeilen',
        }),
      ],
      paths,
    )
    expect(p.description).toBe('Fein & süß Zwei Zeilen')
  })

  it('sorts by popularity first and name second', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Zucker', products_viewed: 5 }),
        product({ products_id: 2, products_name: 'Apfel', products_viewed: 5 }),
        product({ products_id: 3, products_name: 'Brot', products_viewed: 99 }),
      ],
      paths,
    )
    expect(products.map((p) => p.name)).toStrictEqual(['Brot', 'Apfel', 'Zucker'])
  })

  it('makes duplicate slugs unique', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Honig', category_id: 1 }),
        product({
          products_id: 2,
          products_name: 'Honig',
          category_id: 2,
          category_name: 'Imkerei',
        }),
      ],
      paths,
    )
    expect(products.map((p) => p.slug).sort()).toStrictEqual(['honig', 'honig-2'])
  })

  it('keeps products of the same base name apart when they sit in different categories', () => {
    const products = groupProducts(
      [
        product({ products_id: 1, products_name: 'Saft 1 Liter', category_id: 1 }),
        product({ products_id: 2, products_name: 'Saft 1 Liter', category_id: 2 }),
      ],
      paths,
    )
    expect(products).toHaveLength(2)
  })

  it('exposes the optional meta fields only when the columns are filled', () => {
    const [filled] = groupProducts(
      [
        product({
          products_id: 1,
          products_model: 'ART-1',
          products_content: '<b>Inhalt</b>',
          products_description2: 'Details',
          products_head_title_tag: 'Titel',
          products_head_desc_tag: '<i>Beschreibung</i>',
          products_head_keywords_tag: 'a,b',
          products_viewed: 3,
          products_date_added: '2026-02-01T00:00:00.000Z',
        }),
      ],
      paths,
    )
    expect(filled).toMatchObject({
      model: 'ART-1',
      content: 'Inhalt',
      details: 'Details',
      metaTitle: 'Titel',
      metaDescription: 'Beschreibung',
      metaKeywords: 'a,b',
      viewCount: 3,
      dateAdded: '2026-02-01T00:00:00.000Z',
    })

    const [empty] = groupProducts([product({ products_id: 1 })], paths)
    expect(empty.model).toBeUndefined()
    expect(empty.dateAdded).toBeUndefined()
  })

  it('drops implausible legacy dates', () => {
    const [p] = groupProducts(
      [product({ products_id: 1, products_date_added: '1999-01-01T00:00:00.000Z' })],
      paths,
    )
    expect(p.dateAdded).toBeUndefined()
  })

  it('uses products_sizes as the unit when the name carries no size suffix', () => {
    const [p] = groupProducts(
      [product({ products_id: 1, products_name: 'Honig', products_sizes: '<b>250 g Glas</b>' })],
      paths,
    )
    expect(p.unit).toBe('250 g Glas')
  })

  it('falls back to the slugified category name when no path was built', () => {
    const [p] = groupProducts(
      [product({ products_id: 1, category_id: 42, category_name: 'Süße Waren' })],
      new Map(),
    )
    expect(p.category).toBe('suesse-waren')
  })
})
