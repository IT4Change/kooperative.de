// @vitest-environment node
import { createHash, createHmac } from 'node:crypto'

import { createEvent } from 'h3'
import { describe, it, expect, vi, afterEach } from 'vitest'

import '../../test/setup-server'
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  getCustomerSession,
  requireSession,
  generateInsecureSalt,
} from './auth'

import type { H3Event } from 'h3'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Customer authentication. Two separate mechanisms live here and both are
 * security-relevant: the osCommerce password format (md5 with a two-character
 * salt, kept for compatibility with the accounts the old shop created), and the
 * HMAC-signed session cookie this app issues.
 */

/** Minimal but real H3 event, so cookie handling is exercised rather than faked. */
function makeEvent(cookieHeader?: string): H3Event {
  const headers: Record<string, string> = {}
  if (cookieHeader) headers.cookie = cookieHeader
  const res = {
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    getHeaderNames: vi.fn(() => []),
    removeHeader: vi.fn(),
    headersSent: false,
  }
  return createEvent(
    { headers, url: '/' } as unknown as IncomingMessage,
    res as unknown as ServerResponse,
  )
}

/** Reads back what setCookie wrote, without depending on header formatting. */
function cookieFrom(event: H3Event): string {
  const calls = (event.node.res.setHeader as ReturnType<typeof vi.fn>).mock.calls
  const setCookieCall = calls.find(([name]) => String(name).toLowerCase() === 'set-cookie')
  const value = setCookieCall?.[1]
  return Array.isArray(value) ? String(value[0]) : String(value ?? '')
}

describe('password hashing', () => {
  it('produces a hash:salt pair the verifier accepts', () => {
    const stored = hashPassword('supersecret')

    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{2}$/)
    expect(verifyPassword('supersecret', stored)).toBe(true)
  })

  it('salts each hash, so identical passwords do not collide', () => {
    // A shared hash would let an attacker spot reused passwords in a dump.
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })

  it('rejects the wrong password', () => {
    expect(verifyPassword('wrong', hashPassword('supersecret'))).toBe(false)
  })

  it.each([
    ['an empty hash half', ':ab'],
    ['an empty salt half', 'd41d8cd98f00b204e9800998ecf8427e:'],
  ])('rejects a stored password with %s', (_label, stored) => {
    // Truncated rows like these exist in the legacy table; treating the empty
    // half as a match would let anyone into those accounts.
    expect(verifyPassword('geheim', stored)).toBe(false)
  })

  it('accepts a hash written by the old shop', () => {
    // Built here with plain crypto, not with hashPassword — this is the actual
    // compatibility claim: accounts created by osCommerce must still log in.
    const salt = 'ab'
    const stored = `${createHash('md5')
      .update(salt + 'geheim')
      .digest('hex')}:${salt}`

    expect(verifyPassword('geheim', stored)).toBe(true)
    expect(verifyPassword('falsch', stored)).toBe(false)
  })

  it.each([
    ['an empty password', '', 'abc:de'],
    ['an empty stored value', 'pw', ''],
    ['a value without a salt', 'pw', 'abcdef'],
    ['a value with too many parts', 'pw', 'a:b:c'],
    ['a hash of the wrong length', 'pw', 'short:ab'],
  ])('rejects %s', (_label, plain, stored) => {
    expect(verifyPassword(plain, stored)).toBe(false)
  })

  it('generates a salt of usable length', () => {
    expect(generateInsecureSalt()).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('session tokens', () => {
  it('signs and verifies a round trip', () => {
    const token = signSession({ customerId: 7, email: 'e@example.org' })

    expect(verifySession(token)).toMatchObject({ customerId: 7, email: 'e@example.org' })
  })

  it('sets issue and expiry timestamps', () => {
    const before = Math.floor(Date.now() / 1000)
    const payload = verifySession(signSession({ customerId: 1, email: 'a@b.c' }))!

    expect(payload.iat).toBeGreaterThanOrEqual(before)
    // 30 days
    expect(payload.exp - payload.iat).toBe(60 * 60 * 24 * 30)
  })

  it('rejects a token whose payload was tampered with', () => {
    const token = signSession({ customerId: 7, email: 'e@example.org' })
    const [, sig] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ customerId: 999, email: 'attacker@example.org', iat: 0, exp: 9e9 }),
    ).toString('base64url')

    // Signature belongs to a different payload — the whole point of signing it.
    expect(verifySession(`${forged}.${sig}`)).toBeNull()
  })

  it.each([
    ['no token at all', undefined],
    ['an empty token', ''],
    ['a token without a separator', 'abcdef'],
    ['a token with a wrong-length signature', 'body.short'],
  ])('rejects %s', (_label, token) => {
    expect(verifySession(token)).toBeNull()
  })

  it('rejects a correctly signed token whose body is not JSON', () => {
    // Signed with the real secret, so the HMAC check passes and the token gets
    // as far as JSON.parse — which is the branch under test here.
    vi.stubEnv('SESSION_SECRET', 'für-diesen-test')
    const body = Buffer.from('kein json').toString('base64url')
    const sig = createHmac('sha256', Buffer.from('für-diesen-test', 'utf8'))
      .update(body)
      .digest('base64url')

    expect(verifySession(`${body}.${sig}`)).toBeNull()
  })

  it('rejects an expired token', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const token = signSession({ customerId: 1, email: 'a@b.c' })

      // One second past the 30-day lifetime.
      vi.setSystemTime(new Date('2026-01-31T00:00:01Z'))
      expect(verifySession(token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('is bound to the configured secret', () => {
    vi.stubEnv('SESSION_SECRET', 'secret-one')
    const token = signSession({ customerId: 1, email: 'a@b.c' })
    expect(verifySession(token)).not.toBeNull()

    // A rotated secret must invalidate every session that is still out there.
    vi.stubEnv('SESSION_SECRET', 'secret-two')
    expect(verifySession(token)).toBeNull()
    vi.unstubAllEnvs()
  })
})

describe('session cookie', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('writes an httpOnly cookie that verifies', () => {
    const event = makeEvent()

    setSessionCookie(event, 5, 'e@example.org')

    const cookie = cookieFrom(event)
    expect(cookie).toContain('koop_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')

    const token = decodeURIComponent(cookie.split(';')[0].split('=')[1])
    expect(verifySession(token)).toMatchObject({ customerId: 5 })
  })

  it('marks the cookie Secure only in production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const dev = makeEvent()
    setSessionCookie(dev, 1, 'a@b.c')
    expect(cookieFrom(dev)).not.toContain('Secure')

    vi.stubEnv('NODE_ENV', 'production')
    const prod = makeEvent()
    setSessionCookie(prod, 1, 'a@b.c')
    expect(cookieFrom(prod)).toContain('Secure')
  })

  it('clears the cookie on logout', () => {
    const event = makeEvent()

    clearSessionCookie(event)

    expect(cookieFrom(event)).toMatch(/koop_session=;/)
  })

  it('reads the session back from the request cookie', () => {
    const token = signSession({ customerId: 9, email: 'e@example.org' })

    expect(getCustomerSession(makeEvent(`koop_session=${token}`))).toMatchObject({ customerId: 9 })
  })

  it('returns null without a cookie', () => {
    expect(getCustomerSession(makeEvent())).toBeNull()
  })
})

describe('requireSession', () => {
  it('returns the session when one exists', () => {
    const token = signSession({ customerId: 4, email: 'e@example.org' })

    expect(requireSession(makeEvent(`koop_session=${token}`))).toMatchObject({ customerId: 4 })
  })

  it('refuses with 401 when there is none', () => {
    expect(() => requireSession(makeEvent())).toThrow(
      expect.objectContaining({ statusCode: 401, statusMessage: 'Nicht eingeloggt' }),
    )
  })
})
