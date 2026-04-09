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
  products_name: string
  products_description: string | null
  products_sizes: string | null
  category_id: number
  category_name: string
}

interface DbCategory {
  categories_id: number
  categories_name: string
  parent_id: number
  sort_order: number | null
}

// Matches size suffixes like "0,5 Liter", "10 Liter", "1 kg", "450 g"
const SIZE_REGEX = /^(.+?)\s+(\d+(?:[,\.]\d+)?)\s*(Liter|l|L|ml|kg|g)\s*$/

function parseSize(name: string): { baseName: string, size: string, amount: number, unit: string } | null {
  const match = name.match(SIZE_REGEX)
  if (!match) return null

  const baseName = match[1].trim()
  const numStr = match[2].replace(',', '.')
  const amount = parseFloat(numStr)
  let unit = match[3]

  // Normalize unit
  const unitLower = unit.toLowerCase()
  if (unitLower === 'liter' || unitLower === 'l') unit = 'L'
  if (unitLower === 'ml') unit = 'ml'
  if (unitLower === 'kg') unit = 'kg'
  if (unitLower === 'g') unit = 'g'

  // Build display size
  const size = `${match[2]} ${unit}`

  // Convert to reference unit amount
  let refAmount = amount
  if (unit === 'ml') { refAmount = amount / 1000; unit = 'L' }
  if (unit === 'g') { refAmount = amount / 1000; unit = 'kg' }

  return { baseName, size, amount: refAmount, unit }
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
  // First pass: identify which rows are variants
  const groups = new Map<string, DbProduct[]>()

  for (const row of rows) {
    const parsed = parseSize(row.products_name)
    if (parsed) {
      const key = `${parsed.baseName}__${row.category_id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    } else {
      // Standalone product (no size in name)
      groups.set(`__solo__${row.products_id}`, [row])
    }
  }

  const products: Product[] = []

  for (const [, group] of groups) {
    if (group.length === 1) {
      // Single product (no variants)
      const row = group[0]
      const parsed = parseSize(row.products_name)
      products.push({
        id: String(row.products_id),
        name: parsed ? parsed.baseName : row.products_name,
        price: Number(row.products_price),
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
      const baseParsed = parseSize(base.products_name)
      const baseName = baseParsed?.baseName ?? base.products_name

      // Collect all available images from the group for fallback
      const allGroupImages: string[] = []
      for (const row of sorted) {
        allGroupImages.push(...collectImages(row))
      }
      const fallbackImage = allGroupImages[0] ?? ''

      const variants: ProductVariant[] = sorted.map((row) => {
        const parsed = parseSize(row.products_name)!
        const rowImages = collectImages(row)
        return {
          size: parsed.size,
          price: Number(row.products_price),
          amount: parsed.amount,
          referenceUnit: parsed.unit,
          image: rowImages[0] ?? fallbackImage,
        }
      })

      // Sort variants by amount
      variants.sort((a, b) => a.amount - b.amount)

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
      })
    }
  }

  // Sort by name
  products.sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return products
}
