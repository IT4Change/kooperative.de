import type { RowDataPacket } from 'mysql2/promise'
import { verifyPassword, setSessionCookie } from '../../utils/auth'
import { parseLogin } from '../../utils/validate'
import { dbUpdateExpr } from '../../utils/dbWrite'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = parseLogin(body)

  const db = useDB()
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT customers_id, customers_password, customers_firstname, customers_lastname, customers_email_address FROM customers WHERE customers_email_address = ? LIMIT 1',
    [input.email],
  )
  const row = rows[0]

  // Generic message: don't reveal whether email exists
  const fail = () => createError({ statusCode: 401, statusMessage: 'E-Mail oder Passwort falsch' })

  if (!row) throw fail()
  if (!verifyPassword(input.password, String(row.customers_password))) throw fail()

  const customerId = row.customers_id as number
  const remoteIp = getRequestIP(event, { xForwardedFor: true }) ?? undefined

  // Best-effort logon counter, exactly like the old shop
  try {
    await dbUpdateExpr(db, 'customers_info',
      { customers_info_id: customerId },
      'customers_info_date_of_last_logon = NOW(), customers_info_number_of_logons = COALESCE(customers_info_number_of_logons, 0) + 1',
      [],
      { customerId, remoteIp },
    )
  } catch (err) {
    console.warn('[login] customers_info update failed:', err)
  }

  setSessionCookie(event, customerId, input.email)
  return {
    ok: true,
    customerId,
    email: input.email,
    firstname: String(row.customers_firstname || ''),
    lastname: String(row.customers_lastname || ''),
  }
})
