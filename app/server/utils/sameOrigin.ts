import type { H3Event } from 'h3'

/**
 * Whether a request was sent by a page of this site — or by no browser at all.
 *
 * The admin is protected by HTTP Basic auth, and a browser attaches those
 * credentials to every request to the site, including one a foreign page fires
 * off (a hidden form posting to /admin/api/...). SameSite does not apply to
 * Basic auth the way it does to cookies, so state-changing admin requests need
 * this check against cross-site request forgery.
 *
 * - `Sec-Fetch-Site` (all current browsers) is authoritative: only same-origin
 *   or a user-initiated navigation ("none") pass. "same-site" does not — a
 *   compromised sibling subdomain must not be able to act in the admin.
 * - Without it, the `Origin` header has to name this host.
 * - With neither, the request comes from something that is not a browser
 *   (curl, scripts/legal-import.mjs …). Browsers always send Origin on
 *   cross-origin POSTs, so this is not a way around the check.
 *
 * The host comparison honours X-Forwarded-Host: behind the reverse proxy the
 * Host header names the upstream. A cross-site page cannot set that header
 * without a CORS preflight, which the admin never answers.
 */
export function isSameOriginRequest(event: H3Event): boolean {
  const site = getRequestHeader(event, 'sec-fetch-site')
  if (site) return site === 'same-origin' || site === 'none'

  const origin = getRequestHeader(event, 'origin')
  if (!origin) return true
  try {
    return new URL(origin).host === getRequestHost(event, { xForwardedHost: true })
  } catch {
    // "null" (sandboxed frame, file://) or garbage: nothing to vouch for it.
    return false
  }
}
