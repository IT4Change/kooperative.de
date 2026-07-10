import { getRouterParam } from 'h3'
import { getPendingByToken } from '../../../utils/pendingOrder'

/**
 * Public (token-gated) read of a pending order, for the customer review page.
 * Returns the pinned order content so the customer can check it before confirming.
 */
export default defineEventHandler(async (event) => {
  const token = (getRouterParam(event, 'token') || '').trim()
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Token fehlt' })

  const db = useDB()
  const pending = await getPendingByToken(db, token)
  if (!pending || !pending.payload?.comp) {
    throw createError({ statusCode: 404, statusMessage: 'Bestellung nicht gefunden' })
  }
  const comp = pending.payload.comp

  return {
    status: pending.status,
    orderId: pending.ordersId,
    customer: {
      name: comp.customer.name,
      email: comp.customer.email,
      street: comp.customer.street,
      postcode: comp.customer.postcode,
      city: comp.customer.city,
      country: comp.customer.country,
    },
    items: comp.lines.map(l => ({
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitGross,
      lineTotal: l.lineGross,
    })),
    subtotal: comp.subtotalGross,
    shipping: { label: comp.shipping.module, price: comp.shipping.gross },
    taxRows: comp.taxRows.map(t => ({ description: t.description, total: Math.round(t.total * 100) / 100 })),
    payment: comp.payment.label,
    notes: comp.notes ?? '',
    total: comp.total,
  }
})
