import type { H3Event } from 'h3'

/**
 * Absolute URLs for links inside mails. Derived from the incoming request host
 * so links match whatever environment served the request; overridable via
 * PUBLIC_BASE_URL for setups behind a proxy where the host header differs.
 */
export function baseUrl(event: H3Event): string {
  const override = process.env.PUBLIC_BASE_URL
  if (override) return override.replace(/\/$/, '')
  const url = getRequestURL(event)
  return `${url.protocol}//${url.host}`
}

/** Customer review + confirm page (token-gated). Doubles as the "check content" link. */
export function reviewLink(event: H3Event, token: string): string {
  return `${baseUrl(event)}/bestellung/bestaetigen?token=${encodeURIComponent(token)}`
}

export function adminOrderLink(event: H3Event, id: number): string {
  return `${baseUrl(event)}/admin/orders/${id}`
}

/** The withdrawal function (§ 356a BGB), prefilled with an order number if given. */
export function withdrawalLink(event: H3Event, orderId?: number): string {
  const query = orderId === undefined ? '' : `?bestellung=${orderId}`
  return `${baseUrl(event)}/vertrag-widerrufen${query}`
}

export function adminWithdrawalsLink(event: H3Event): string {
  return `${baseUrl(event)}/admin/withdrawals`
}
