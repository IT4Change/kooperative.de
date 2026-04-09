export type CategorySlug = string

export interface Category {
  slug: CategorySlug
  name: string
  description: string
}

export interface ProductVariant {
  size: string
  price: number
  amount: number
  referenceUnit: string
  image: string
  minQty?: number // For quantity tiers: minimum order quantity for this tier
}

export interface Product {
  id: string
  slug: string
  name: string
  price: number
  description: string
  category: CategorySlug
  unit?: string
  images: readonly string[]
  variants?: readonly ProductVariant[]
  variantType?: 'size' | 'quantity'
  model?: string
  content?: string
  details?: string
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  viewCount?: number
}

export interface CartItem {
  product: Product
  quantity: number
  variantIndex?: number
}

export function unitPrice(variant: ProductVariant): number {
  return variant.price / variant.amount
}

/** For quantity-tier products: find the best tier for a given quantity */
export function findTierIndex(variants: readonly ProductVariant[], quantity: number): number {
  let best = 0
  for (let i = 1; i < variants.length; i++) {
    if (variants[i].minQty && quantity >= variants[i].minQty) {
      best = i
    }
  }
  return best
}

/** For quantity-tier products: calculate total price for a quantity */
export function tierTotalPrice(variants: readonly ProductVariant[], quantity: number): number {
  const idx = findTierIndex(variants, quantity)
  return variants[idx].price * quantity
}

export interface OrderFormData {
  name: string
  street: string
  zip: string
  city: string
  email: string
  phone: string
  notes: string
}
