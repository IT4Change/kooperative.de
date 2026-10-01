/**
 * Baseline security headers for every response. The "00." prefix makes Nitro
 * run this before admin-auth, so a 401 from there still carries them.
 *
 * The CSP deliberately leaves script-src and style-src open: Nuxt inlines its
 * payload and the storage-probe head script, and a nonce setup is a project of
 * its own. What is set here is safe regardless and closes clickjacking, <base>
 * hijacking, plugin content and cross-site form posts.
 */
const CSP = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"]

// Pages that must never show up in a search index: the admin area, the order
// confirmation page (its URL carries a one-time token) and the raw API.
const NOINDEX_PATH = /^\/(admin|bestellung|api)(\/|$|\?)/

const BASELINE: Record<string, string> = {
  'Content-Security-Policy': CSP.join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

export default defineEventHandler((event) => {
  for (const [name, value] of Object.entries(BASELINE)) {
    setResponseHeader(event, name, value)
  }

  // Only production is guaranteed to sit behind HTTPS. No includeSubDomains:
  // other kooperative.de hosts are not ours to force onto HTTPS.
  if (process.env.NODE_ENV === 'production') {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000')
  }

  if (NOINDEX_PATH.test(event.path)) {
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  }
})
