import { requireSession } from '../utils/auth'
import { placeDirectOrder } from '../utils/directOrder'
import { computeOrder } from '../utils/orderCompute'
import { parseOrder } from '../utils/validate'

/**
 * New-shop checkout. "Zahlungspflichtig bestellen" is the customer's binding
 * offer (§ 312j BGB): the order is written to osCommerce right away and the
 * customer receives a receipt — not yet an acceptance, see AGB § 2 and
 * placeDirectOrder().
 */
export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const input = parseOrder(body)
  const remoteIp = getRequestIP(event, { xForwardedFor: true })
  const db = useDB()

  const comp = await computeOrder(db, session.customerId, input)
  const { ordersId } = await placeDirectOrder(db, event, { input, comp }, { remoteIp })

  return { ok: true, orderId: ordersId, total: comp.total }
})
