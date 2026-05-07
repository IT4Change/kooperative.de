import type { RowDataPacket } from 'mysql2/promise'
import { getSession, clearSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = getSession(event)
  if (!session) return { authenticated: false }

  const db = useDB()
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.customers_id, c.customers_email_address, c.customers_firstname, c.customers_lastname,
            c.customers_telephone, c.customers_default_address_id,
            ab.entry_street_address, ab.entry_postcode, ab.entry_city, ab.entry_country_id
     FROM customers c
     LEFT JOIN address_book ab ON ab.address_book_id = c.customers_default_address_id
     WHERE c.customers_id = ? LIMIT 1`,
    [session.customerId],
  )
  const row = rows[0]
  if (!row) {
    clearSessionCookie(event)
    return { authenticated: false }
  }
  return {
    authenticated: true,
    customerId: row.customers_id,
    email: String(row.customers_email_address || ''),
    firstname: String(row.customers_firstname || ''),
    lastname: String(row.customers_lastname || ''),
    telephone: String(row.customers_telephone || ''),
    address: {
      street: String(row.entry_street_address || ''),
      postcode: String(row.entry_postcode || ''),
      city: String(row.entry_city || ''),
      countryId: Number(row.entry_country_id || 0),
    },
  }
})
