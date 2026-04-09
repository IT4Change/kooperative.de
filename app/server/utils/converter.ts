import type { Product, ProductVariant, Category, CategorySlug } from '~/data/products'

export interface DbProduct {
  products_id: number
  products_price: number
  products_image: string | null
  products_image_detail_1: string
  products_image_detail_2: string
  products_image_detail_3: string
  products_image_detail_4: string
  products_image_detail_5: string
  products_status: number
  products_tax_class_id: number
  tax_rate: number
  products_name: string
  products_description: string | null
  products_sizes: string | null
  category_id: number
  category_name: string
}

function grossPrice(netPrice: number, taxRate: number): number {
  return Math.round(netPrice * (1 + taxRate / 100) * 100) / 100
}

interface DbCategory {
  categories_id: number
  categories_name: string
  parent_id: number
  sort_order: number | null
}

// Matches size suffixes like "0,5 Liter", "10 Liter", "1 kg", "450 g"
const SIZE_REGEX = /^(.+?)\s+(\d+(?:[,\.]\d+)?)\s*(Liter|l|L|ml|kg|g)\s*$/

// Matches quantity tier suffixes like "10+", "50+", "800+"
const QUANTITY_REGEX = /^(.+?)\s+(\d+)\+\s*$/

interface ParsedVariant {
  baseName: string
  size: string
  amount: number
  unit: string
  type: 'size' | 'quantity'
}

function parseVariant(name: string): ParsedVariant | null {
  // Try size first
  const sizeMatch = name.match(SIZE_REGEX)
  if (sizeMatch) {
    const baseName = sizeMatch[1].trim()
    const numStr = sizeMatch[2].replace(',', '.')
    const amount = parseFloat(numStr)
    let unit = sizeMatch[3]

    const unitLower = unit.toLowerCase()
    if (unitLower === 'liter' || unitLower === 'l') unit = 'L'
    if (unitLower === 'ml') unit = 'ml'
    if (unitLower === 'kg') unit = 'kg'
    if (unitLower === 'g') unit = 'g'

    const size = `${sizeMatch[2]} ${unit}`
    let refAmount = amount
    if (unit === 'ml') { refAmount = amount / 1000; unit = 'L' }
    if (unit === 'g') { refAmount = amount / 1000; unit = 'kg' }

    return { baseName, size, amount: refAmount, unit, type: 'size' }
  }

  // Try quantity tier
  const qtyMatch = name.match(QUANTITY_REGEX)
  if (qtyMatch) {
    const baseName = qtyMatch[1].trim()
    const minQty = parseInt(qtyMatch[2])
    return { baseName, size: `ab ${minQty} Stk.`, amount: 1, unit: 'Stk', type: 'quantity' }
  }

  return null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildImageUrl(filename: string | null): string | null {
  if (!filename || filename.trim() === '') return null
  return `https://shop.kooperative.de/images/${filename}`
}

function collectImages(row: DbProduct): string[] {
  const images: string[] = []
  const mainImg = buildImageUrl(row.products_image)
  if (mainImg) images.push(mainImg)
  for (const col of [
    row.products_image_detail_1,
    row.products_image_detail_2,
    row.products_image_detail_3,
    row.products_image_detail_4,
    row.products_image_detail_5,
  ]) {
    const img = buildImageUrl(col)
    if (img) images.push(img)
  }
  return images
}

export function convertCategory(row: DbCategory): Category {
  return {
    slug: slugify(row.categories_name) as CategorySlug,
    name: row.categories_name,
    description: '',
  }
}

/**
 * Groups DB rows into Products, merging size variants.
 * Variant detection: products with matching base name (minus size suffix)
 * and same category, where variant rows typically have no images.
 */
export function groupProducts(rows: DbProduct[]): Product[] {
  // First pass: group variant rows by base name
  const groups = new Map<string, DbProduct[]>()
  const solos: DbProduct[] = []

  for (const row of rows) {
    const parsed = parseVariant(row.products_name)
    if (parsed) {
      const key = `${parsed.baseName}__${row.category_id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    } else {
      solos.push(row)
    }
  }

  // Second pass: check if any solo product is actually the base of a variant group
  for (const row of solos) {
    const key = `${row.products_name.trim()}__${row.category_id}`
    if (groups.has(key)) {
      // This solo is the base product for an existing variant group
      groups.get(key)!.unshift(row)
    } else {
      groups.set(`__solo__${row.products_id}`, [row])
    }
  }

  const products: Product[] = []

  for (const [, group] of groups) {
    if (group.length === 1) {
      // Single product (no variants)
      const row = group[0]
      const parsed = parseVariant(row.products_name)
      products.push({
        id: String(row.products_id),
        name: parsed ? parsed.baseName : row.products_name,
        price: grossPrice(Number(row.products_price), row.tax_rate),
        description: stripHtml(row.products_description),
        category: slugify(row.category_name) as CategorySlug,
        unit: parsed ? parsed.size : (row.products_sizes ? stripHtml(row.products_sizes) : undefined),
        images: collectImages(row),
      })
    } else {
      // Multiple variants — find the base (the one with images)
      const sorted = [...group].sort((a, b) => {
        const aHasImg = a.products_image ? 1 : 0
        const bHasImg = b.products_image ? 1 : 0
        return bHasImg - aHasImg // images first
      })

      const base = sorted[0]
      const baseParsed = parseVariant(base.products_name)
      const baseName = baseParsed?.baseName ?? base.products_name

      // Collect all available images from the group for fallback
      const allGroupImages: string[] = []
      for (const row of sorted) {
        allGroupImages.push(...collectImages(row))
      }
      const fallbackImage = allGroupImages[0] ?? ''

      // Determine variant type from the first parsed variant
      const firstParsed = sorted.map(r => parseVariant(r.products_name)).find(p => p !== null)
      const variantType = firstParsed?.type ?? 'size'

      const variants: ProductVariant[] = sorted.map((row) => {
        const parsed = parseVariant(row.products_name)
        const rowImages = collectImages(row)
        if (parsed) {
          return {
            size: parsed.size,
            price: grossPrice(Number(row.products_price), row.tax_rate),
            amount: parsed.amount,
            referenceUnit: parsed.unit,
            image: rowImages[0] ?? fallbackImage,
            ...(parsed.type === 'quantity' ? { minQty: parseInt(row.products_name.match(/(\d+)\+/)?.[1] ?? '1') } : {}),
          }
        }
        // Base product without suffix (e.g. single unit for quantity tiers)
        return {
          size: '1 Stk.',
          price: grossPrice(Number(row.products_price), row.tax_rate),
          amount: 1,
          referenceUnit: 'Stk',
          image: rowImages[0] ?? fallbackImage,
          minQty: 1,
        }
      })

      // Sort variants: by minQty for quantity tiers, by amount for size variants
      if (variantType === 'quantity') {
        variants.sort((a, b) => (a.minQty ?? 0) - (b.minQty ?? 0))
      } else {
        variants.sort((a, b) => a.amount - b.amount)
      }

      // Use description from the base product
      const baseDescription = stripHtml(base.products_description)
      // Collect images: base first, then any from variants as fallback
      let images = collectImages(base)
      if (images.length === 0) {
        for (const row of sorted) {
          images = collectImages(row)
          if (images.length > 0) break
        }
      }

      products.push({
        id: String(base.products_id),
        name: baseName,
        price: variants[0].price,
        description: baseDescription,
        category: slugify(base.category_name) as CategorySlug,
        images,
        variants,
        ...(variantType === 'quantity' ? { variantType: 'quantity' as const } : {}),
      })
    }
  }

  // Sort by name
  products.sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return products
}
