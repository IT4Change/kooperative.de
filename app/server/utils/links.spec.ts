// @vitest-environment node
import { createEvent } from 'h3'
import { describe, it, expect, afterEach } from 'vitest'

import '../../test/setup-server'

import { baseUrl, reviewLink, adminPendingLink, adminOrderLink } from './links'

import type { H3Event } from 'h3'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Real H3Event over a minimal node request — baseUrl only reads protocol + host. */
function eventFor(url: string): H3Event {
  const u = new URL(url)
  const req = {
    url: u.pathname + u.search,
    headers: { host: u.host, 'x-forwarded-proto': u.protocol.replace(':', '') },
  } as unknown as IncomingMessage
  return createEvent(req, {} as unknown as ServerResponse)
}

describe('baseUrl', () => {
  afterEach(() => {
    delete process.env.PUBLIC_BASE_URL
  })

  it('derives protocol and host from the incoming request', () => {
    expect(baseUrl(eventFor('https://shop.kooperative.de/api/orders'))).toBe(
      'https://shop.kooperative.de',
    )
  })

  it('prefers PUBLIC_BASE_URL over the request host', () => {
    process.env.PUBLIC_BASE_URL = 'https://proxy.example.org'
    expect(baseUrl(eventFor('http://internal:3000/api/orders'))).toBe('https://proxy.example.org')
  })

  it('strips a trailing slash from the override', () => {
    process.env.PUBLIC_BASE_URL = 'https://proxy.example.org/'
    expect(baseUrl(eventFor('http://internal:3000/'))).toBe('https://proxy.example.org')
  })
})

describe('link builders', () => {
  const event = eventFor('https://shop.kooperative.de/api/orders')

  it('builds the token-gated customer review link', () => {
    expect(reviewLink(event, 'abc123')).toBe(
      'https://shop.kooperative.de/bestellung/bestaetigen?token=abc123',
    )
  })

  it('URL-encodes the token', () => {
    expect(reviewLink(event, 'a b&c')).toBe(
      'https://shop.kooperative.de/bestellung/bestaetigen?token=a%20b%26c',
    )
  })

  it('builds the admin deep links', () => {
    expect(adminPendingLink(event, 42)).toBe('https://shop.kooperative.de/admin/pending/42')
    expect(adminOrderLink(event, 7)).toBe('https://shop.kooperative.de/admin/orders/7')
  })
})
