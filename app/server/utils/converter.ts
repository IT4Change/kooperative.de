import type { Product, Category, CategorySlug } from '~/data/products'

interface DbProduct {
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

export function convertCategory(row: DbCategory): Category {
  return {
    slug: slugify(row.categories_name) as CategorySlug,
    name: row.categories_name,
    description: '',
  }
}

export function convertProduct(row: DbProduct): Product {
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

  // Fallback if no images
  if (images.length === 0) {
    images.push(`https://picsum.photos/seed/${row.products_id}/400/300`)
  }

  return {
    id: String(row.products_id),
    name: row.products_name,
    price: Number(row.products_price),
    description: stripHtml(row.products_description),
    category: slugify(row.category_name) as CategorySlug,
    unit: row.products_sizes ? stripHtml(row.products_sizes) : undefined,
    images,
  }
}
