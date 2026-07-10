import type { H3Event } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { getRequestHeader, setResponseHeader } from 'h3'

/**
 * HTTP Basic Auth for the /admin area — replaces the old osCommerce
 * `.htaccess`/`.htpasswd` protection with an app-level equivalent, so the same
 * native browser password dialog appears without depending on Apache/nginx.
 *
 * Credentials come from the env var ADMIN_USERS = "user1:pass1,user2:pass2".
 * Fail-closed: if unset in production the area is locked (503); in dev a
 * throwaway `admin:admin` fallback is used with a warning.
 */

const REALM = 'Kooperative Admin'

interface Creds {
  users: Map<string, string>
  configured: boolean
}

function parseCredentials(): Creds {
  const raw = process.env.ADMIN_USERS || ''
  const users = new Map<string, string>()
  for (const pair of raw.split(',')) {
    const t = pair.trim()
    if (!t) continue
    const i = t.indexOf(':')
    if (i === -1) continue
    users.set(t.slice(0, i), t.slice(i + 1))
  }
  if (users.size > 0) return { users, configured: true }
  if (process.env.NODE_ENV !== 'production') {
    users.set('admin', 'admin')
    return { users, configured: true }
  }
  return { users, configured: false }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function checkAdminAuth(event: H3Event): boolean {
  const { users } = parseCredentials()
  if (users.size === 0) return false

  const header = getRequestHeader(event, 'authorization') || ''
  if (!header.startsWith('Basic ')) return false

  let decoded = ''
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  } catch {
    return false
  }
  const i = decoded.indexOf(':')
  if (i === -1) return false
  const user = decoded.slice(0, i)
  const pass = decoded.slice(i + 1)

  const expected = users.get(user)
  if (expected === undefined) {
    // constant-work path to avoid leaking user existence via timing
    safeEqual(pass, pass)
    return false
  }
  return safeEqual(pass, expected)
}

/** The authenticated Basic-Auth username (for audit / mail "sent_by"), or null. */
export function getAdminUser(event: H3Event): string | null {
  const header = getRequestHeader(event, 'authorization') || ''
  if (!header.startsWith('Basic ')) return null
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const i = decoded.indexOf(':')
    return i === -1 ? null : decoded.slice(0, i)
  } catch {
    return null
  }
}

export function requireAdminAuth(event: H3Event): void {
  const { configured } = parseCredentials()
  if (!configured) {
    throw createError({ statusCode: 503, statusMessage: 'Admin-Zugang nicht konfiguriert (ADMIN_USERS)' })
  }
  if (!checkAdminAuth(event)) {
    setResponseHeader(event, 'WWW-Authenticate', `Basic realm="${REALM}", charset="UTF-8"`)
    throw createError({ statusCode: 401, statusMessage: 'Authentifizierung erforderlich' })
  }
}
