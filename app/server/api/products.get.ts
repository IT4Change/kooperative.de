import type { RowDataPacket } from 'mysql2'
import { convertProduct, convertCategory } from '../utils/converter'

export default defineEventHandler(async () => {
  const db = useDB()

  const [catRows] = await db.query<RowDataPacket[]>(`
    SELECT c.categories_id, c.parent_id, c.sort_order,
           cd.categories_name
    FROM categories c
    JOIN categories_description cd ON c.categories_id = cd.categories_id AND cd.language_id = 2
    ORDER BY c.sort_order, cd.categories_name
  `)

  const categories = catRows.map(row => convertCategory(row as any))

  const [prodRows] = await db.query<RowDataPacket[]>(`
    SELECT p.products_id, p.products_price,
           p.products_image,
           p.products_image_detail_1,
           p.products_image_detail_2,
           p.products_image_detail_3,
           p.products_image_detail_4,
           p.products_image_detail_5,
           p.products_status,
           pd.products_name,
           pd.products_description,
           pd.products_sizes,
           ptc.categories_id AS category_id,
           cd.categories_name AS category_name
    FROM products p
    JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
    LEFT JOIN products_to_categories ptc ON p.products_id = ptc.products_id
    LEFT JOIN categories_description cd ON ptc.categories_id = cd.categories_id AND cd.language_id = 2
    WHERE p.products_status = 1
    GROUP BY p.products_id
    ORDER BY pd.products_name
  `)

  const products = prodRows.map(row => convertProduct(row as any))

  return { products, categories }
})
