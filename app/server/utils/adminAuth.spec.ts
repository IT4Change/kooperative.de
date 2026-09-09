// @vitest-environment node
import { createEvent } from 'h3'
import { describe, it, expect, vi, afterEach } from 'vitest'

import '../../test/setup-server'

import type { H3Event } from 'h3'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * HTTP Basic auth for /admin, the replacement for the old shop's .htpasswd.
 *
 * Credentials come from ADMIN_USERS and are read on every call, so each test
 * sets the environment it needs. The behaviour that matters is fail-closed:
 * production without configuration must lock the area rather than open it.
 */

function makeEvent(authorization?: string): H3Event {
  const headers: Record<string, string> = {}
  if (authorization) headers.authorization = authorization
  const res = {
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    getHeaderNames: vi.fn(() => []),
    removeHeader: vi.fn(),
    headersSent: false,
  }
  return createEvent(
    { headers, url: '/admin' } as unknown as IncomingMessage,
    res as unknown as ServerResponse,
  )
}

const basic = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('checkAdminAuth', () => {
  it('accepts a configured user', async () => {
    vi.stubEnv('ADMIN_USERS', 'anna:geheim')
    const { checkAdminAuth } = await import('./adminAuth')

    expect(checkAdminAuth(makeEvent(basic('anna', 'geheim')))).toBe(true)
  })

  it('accepts any of several configured users', async () => {
    vi.stubEnv('ADMIN_USERS', 'anna:eins, bert:zwei')
    const { checkAdminAuth } = await import('./adminAuth')

    expect(checkAdminAuth(makeEvent(basic('anna', 'eins')))).toBe(true)
    expect(checkAdminAuth(makeEvent(basic('bert', 'zwei')))).toBe(true)
  })

  it('keeps a password containing a colon intact', async () => {
    // Only the first colon separates user from password.
    vi.stubEnv('ADMIN_USERS', 'anna:ge:heim')
    const { checkAdminAuth } = await import('./adminAuth')

    expect(checkAdminAuth(makeEvent(basic('anna', 'ge:heim')))).toBe(true)
  })

  it.each([
    ['the wrong password', () => basic('anna', 'falsch')],
    ['an unknown user', () => basic('zoe', 'geheim')],
    ['no authorization header', () => undefined],
    ['a non-Basic scheme', () => 'Bearer sometoken'],
    [
      'a Basic value without a colon',
      () => `Basic ${Buffer.from('annageheim').toString('base64')}`,
    ],
  ])('rejects %s', async (_label, header) => {
    vi.stubEnv('ADMIN_USERS', 'anna:geheim')
    const { checkAdminAuth } = await import('./adminAuth')

    expect(checkAdminAuth(makeEvent(header()))).toBe(false)
  })

  it('ignores malformed entries in the configuration', async () => {
    vi.stubEnv('ADMIN_USERS', ',,nonsense,anna:geheim,')
    const { checkAdminAuth } = await import('./adminAuth')

    expect(checkAdminAuth(makeEvent(basic('anna', 'geheim')))).toBe(true)
  })

  it('rejects a password of a different length without leaking the difference', async () => {
    vi.stubEnv('ADMIN_USERS', 'anna:geheim')
    const { checkAdminAuth } = await import('./adminAuth')

    // Different length takes the early-exit branch of the constant-time compare.
    expect(checkAdminAuth(makeEvent(basic('anna', 'x')))).toBe(false)
  })

  it('rejects everyone when production has no credentials configured', async () => {
    // parseCredentials() reports an empty map, and an empty map must never let
    // an empty password through.
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_USERS', '')
    const { checkAdminAuth } = await import('./adminAuth')

    expect(checkAdminAuth(makeEvent(basic('anna', 'geheim')))).toBe(false)
  })
})

describe('getAdminUser', () => {
  it('returns the user name for the audit log', async () => {
    const { getAdminUser } = await import('./adminAuth')

    expect(getAdminUser(makeEvent(basic('anna', 'geheim')))).toBe('anna')
  })

  it.each([
    ['no header', undefined],
    ['a non-Basic scheme', 'Bearer x'],
    ['a value without a colon', `Basic ${Buffer.from('anna').toString('base64')}`],
  ])('returns null for %s', async (_label, header) => {
    const { getAdminUser } = await import('./adminAuth')

    expect(getAdminUser(makeEvent(header))).toBeNull()
  })
})

describe('requireAdminAuth', () => {
  it('passes a valid request through', async () => {
    vi.stubEnv('ADMIN_USERS', 'anna:geheim')
    const { requireAdminAuth } = await import('./adminAuth')

    expect(() => {
      requireAdminAuth(makeEvent(basic('anna', 'geheim')))
    }).not.toThrow()
  })

  it('answers 401 with a challenge so the browser prompts', async () => {
    vi.stubEnv('ADMIN_USERS', 'anna:geheim')
    const { requireAdminAuth } = await import('./adminAuth')
    const event = makeEvent()

    expect(() => {
      requireAdminAuth(event)
    }).toThrow(
      expect.objectContaining({ statusCode: 401, statusMessage: 'Authentifizierung erforderlich' }),
    )
    const header = (event.node.res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      ([name]) => String(name).toLowerCase() === 'www-authenticate',
    )
    expect(String(header?.[1])).toContain('Basic realm="Kooperative Admin"')
  })

  it('locks the area in production when ADMIN_USERS is missing', async () => {
    vi.stubEnv('ADMIN_USERS', '')
    vi.stubEnv('NODE_ENV', 'production')
    const { requireAdminAuth } = await import('./adminAuth')

    // Fail closed: an unconfigured production deployment must not be wide open.
    expect(() => {
      requireAdminAuth(makeEvent(basic('admin', 'admin')))
    }).toThrow(expect.objectContaining({ statusCode: 503 }))
  })

  it('falls back to a throwaway login outside production', async () => {
    vi.stubEnv('ADMIN_USERS', '')
    vi.stubEnv('NODE_ENV', 'development')
    const { requireAdminAuth } = await import('./adminAuth')

    expect(() => {
      requireAdminAuth(makeEvent(basic('admin', 'admin')))
    }).not.toThrow()
    expect(() => {
      requireAdminAuth(makeEvent(basic('admin', 'falsch')))
    }).toThrow(expect.objectContaining({ statusCode: 401 }))
  })
})
