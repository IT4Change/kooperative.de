import { requireSession } from '../utils/auth'
import { placeDirectOrder } from '../utils/directOrder'
import { computeOrder } from '../utils/orderCompute'
import { LIMITS, rateLimit } from '../utils/rateLimit'
import { parseIdempotencyKey, parseOrder } from '../utils/validate'

/**
 * New-shop checkout. "Zahlungspflichtig bestellen" is the customer's binding
 * offer (§ 312j BGB): the order is written to osCommerce right away and the
 * customer receives a receipt — not yet an acceptance, see AGB § 2 and
 * placeDirectOrder(). A repeated attempt (same idempotency key) gets the first
 * order back instead of a second one; the rate limits stop scripted floods.
 */
export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const remoteIp = getRequestIP(event, { xForwardedFor: true })
  rateLimit(event, 'orders:customer', session.customerId, LIMITS.ordersPerCustomer)
  rateLimit(event, 'orders:ip', remoteIp, LIMITS.ordersPerIp)

  const body = await readBody(event)
  const input = parseOrder(body)
  const idempotencyKey = parseIdempotencyKey(body)
  const db = useDB()

  const comp = await computeOrder(db, session.customerId, input)
  const { ordersId } = await placeDirectOrder(
    db,
    event,
    { input, comp, idempotencyKey },
    { remoteIp },
  )

  return { ok: true, orderId: ordersId, total: comp.total }
})
