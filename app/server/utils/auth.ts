import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie } from 'h3'

const SESSION_COOKIE = 'koop_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex')
}

/**
 * osCommerce/xtCommerce password format: md5(salt + plain) + ':' + salt
 * where salt = first 2 chars of md5(random number stack).
 */
export function hashPassword(plain: string): string {
  let entropy = ''
  for (let i = 0; i < 10; i++) entropy += String(Math.floor(Math.random() * 1e9))
  const salt = md5(entropy).slice(0, 2)
  return md5(salt + plain) + ':' + salt
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!plain || !stored) return false
  const parts = stored.split(':')
  if (parts.length !== 2) return false
  const [hash, salt] = parts
  const expected = md5(salt + plain)
  if (expected.length !== hash.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(hash))
}

function getSecret(): Buffer {
  const secret = process.env.SESSION_SECRET || 'dev-only-do-not-use-in-prod-please-change-me-now'
  return Buffer.from(secret, 'utf8')
}

export interface SessionPayload {
  customerId: number
  email: string
  iat: number
  exp: number
}

export function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000)
  const full: SessionPayload = { ...payload, iat: now, exp: now + SESSION_TTL_SECONDS }
  const body = Buffer.from(JSON.stringify(full)).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null
  const idx = token.lastIndexOf('.')
  if (idx === -1) return null
  const body = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = createHmac('sha256', getSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (Math.floor(Date.now() / 1000) >= payload.exp) return null
  return payload
}

export function setSessionCookie(event: H3Event, customerId: number, email: string): void {
  const token = signSession({ customerId, email })
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export function getSession(event: H3Event): SessionPayload | null {
  return verifySession(getCookie(event, SESSION_COOKIE))
}

export function requireSession(event: H3Event): SessionPayload {
  const sess = getSession(event)
  if (!sess) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht eingeloggt' })
  }
  return sess
}

export function generateInsecureSalt(): string {
  return randomBytes(8).toString('hex')
}
