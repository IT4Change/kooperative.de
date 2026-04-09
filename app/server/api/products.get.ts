import { categories, products } from '~/data/products'

export default defineEventHandler(() => {
  return { products, categories }
})
