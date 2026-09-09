// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import '../../test/setup-server'
import { createTestEvent } from '../../test/helpers/event'

import middleware from './admin-auth'

/**
 * Guards the whole /admin space. Two jobs: enforce Basic auth, and tell Nitro
 * that the endpoints under /admin/api serve JSON — Nitro's own heuristic only
 * recognises API routes by a leading "/api/", which these do not have.
 */
const basic = `Basic ${Buffer.from('anna:geheim').toString('base64')}`

beforeEach(() => {
  vi.stubEnv('ADMIN_USERS', 'anna:geheim')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('admin-auth middleware', () => {
  it.each([
    ['/', 'the shop front page'],
    ['/shop', 'the shop'],
    ['/administration', 'a path that merely starts with the same letters'],
  ])('lets %s through untouched (%s)', (url) => {
    const event = createTestEvent({ url })

    expect(() => {
      middleware(event)
    }).not.toThrow()
  })

  it.each(['/admin', '/admin/orders/55', '/admin?x=1'])('guards %s', (url) => {
    const event = createTestEvent({ url })

    expect(() => {
      middleware(event)
    }).toThrow(expect.objectContaining({ statusCode: 401 }))
  })

  it('passes a request with valid credentials', () => {
    const event = createTestEvent({ url: '/admin', headers: { authorization: basic } })

    expect(() => {
      middleware(event)
    }).not.toThrow()
  })

  it('marks an API request as JSON so errors are not rendered as HTML', () => {
    const event = createTestEvent({
      url: '/admin/api/dashboard',
      headers: { authorization: basic, accept: 'text/html' },
    })

    middleware(event)

    // Without this, a 401 from a browser would come back as the Nuxt error page
    // for a path that has no Vue route — wrong content type plus router noise.
    expect(event.node.req.headers.accept).toBe('application/json')
  })

  it('rewrites the header before the auth check, so failures are JSON too', () => {
    const event = createTestEvent({
      url: '/admin/api/dashboard',
      headers: { accept: 'text/html' },
    })

    expect(() => {
      middleware(event)
    }).toThrow(expect.objectContaining({ statusCode: 401 }))
    expect(event.node.req.headers.accept).toBe('application/json')
  })

  it('leaves the admin pages rendering HTML', () => {
    const event = createTestEvent({
      url: '/admin/orders/55',
      headers: { authorization: basic, accept: 'text/html' },
    })

    middleware(event)

    expect(event.node.req.headers.accept).toBe('text/html')
  })
})
