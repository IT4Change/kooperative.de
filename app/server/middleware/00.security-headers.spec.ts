// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'

import '../../test/setup-server'
import { createTestEvent } from '../../test/helpers/event'

import middleware from './00.security-headers'

import type { H3Event } from 'h3'

/**
 * Baseline security headers on every response, plus HSTS in production and a
 * noindex marker on the paths that must stay out of search engines.
 */
function headersOf(event: H3Event): Record<string, string> {
  const calls = (event.node.res.setHeader as ReturnType<typeof vi.fn>).mock.calls
  return Object.fromEntries(calls.map(([name, value]) => [String(name).toLowerCase(), value]))
}

function run(url: string): Record<string, string> {
  const event = createTestEvent({ url })
  middleware(event)
  return headersOf(event)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('security-headers middleware', () => {
  it('sets the baseline headers on every response', () => {
    const headers = run('/shop')

    expect(headers['content-security-policy']).toBe(
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
    )
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
  })

  it('sends HSTS in production only', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(run('/')).not.toHaveProperty('strict-transport-security')

    vi.stubEnv('NODE_ENV', 'production')
    expect(run('/')['strict-transport-security']).toBe('max-age=31536000')
  })

  it.each(['/admin', '/admin/orders/5', '/bestellung/bestaetigen?token=x', '/api/products'])(
    'marks %s as noindex',
    (url) => {
      expect(run(url)['x-robots-tag']).toBe('noindex, nofollow')
    },
  )

  it.each(['/', '/shop', '/impressum', '/administration', '/apitest'])(
    'leaves %s indexable',
    (url) => {
      expect(run(url)).not.toHaveProperty('x-robots-tag')
    },
  )
})
