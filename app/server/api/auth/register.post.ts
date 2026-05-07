import type { RowDataPacket } from 'mysql2/promise'
import { hashPassword, setSessionCookie } from '../../utils/auth'
import { parseRegister } from '../../utils/validate'
import { dbInsert, dbUpdate } from '../../utils/dbWrite'
import { COUNTRY_IDS } from '../../utils/countries'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = parseRegister(body)

  const db = useDB()
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  // Email-uniqueness check (no DB constraint exists). Race-prone on MyISAM, but volume is low.
  const [existing] = await db.execute<RowDataPacket[]>(
    'SELECT customers_id FROM customers WHERE customers_email_address = ? LIMIT 1',
    [input.email],
  )
  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'E-Mail-Adresse bereits registriert' })
  }

  const country = COUNTRY_IDS[input.country]
  const passwordHash = hashPassword(input.password)

  // Step 1: customers row
  const customerId = await dbInsert(db, 'customers', {
    customers_gender: input.gender,
    customers_firstname: input.firstname,
    customers_lastname: input.lastname,
    customers_dob: `${input.dob} 00:00:00`,
    customers_email_address: input.email,
    customers_default_address_id: 0, // patched in step 3
    customers_telephone: input.telephone,
    customers_fax: '',
    customers_password: passwordHash,
    customers_newsletter: '0',
    payment: 'vorkasse',
    rechnung: 0,
    versand: 'gls_gls',
  }, { remoteIp })

  // Step 2: address_book row, then patch the default address back
  let addressId: number
  try {
    addressId = await dbInsert(db, 'address_book', {
      customers_id: customerId,
      entry_gender: input.gender,
      entry_company: '',
      entry_firstname: input.firstname,
      entry_lastname: input.lastname,
      entry_street_address: input.street,
      entry_suburb: '',
      entry_postcode: input.postcode,
      entry_city: input.city,
      entry_state: '',
      entry_country_id: country.id,
      entry_zone_id: 0,
    }, { customerId, remoteIp })
  } catch (err) {
    // Compensation: clean up the half-created customer
    try {
      const { dbDelete } = await import('../../utils/dbWrite')
      await dbDelete(db, 'customers', { customers_id: customerId }, { customerId, remoteIp })
    } catch {}
    throw err
  }

  await dbUpdate(db, 'customers',
    { customers_id: customerId },
    { customers_default_address_id: addressId },
    { customerId, remoteIp },
  )

  await dbInsert(db, 'customers_info', {
    customers_info_id: customerId,
    customers_info_number_of_logons: 0,
    customers_info_date_account_created: new Date(),
    global_product_notifications: 0,
  }, { customerId, remoteIp })

  setSessionCookie(event, customerId, input.email)
  return { ok: true, customerId, email: input.email, firstname: input.firstname, lastname: input.lastname }
})
