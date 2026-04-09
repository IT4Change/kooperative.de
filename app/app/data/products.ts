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
}

export interface Product {
  id: string
  name: string
  price: number
  description: string
  category: CategorySlug
  unit?: string
  images: readonly string[]
  variants?: readonly ProductVariant[]
}

export interface CartItem {
  product: Product
  quantity: number
  variantIndex?: number
}

export function unitPrice(variant: ProductVariant): number {
  return variant.price / variant.amount
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
