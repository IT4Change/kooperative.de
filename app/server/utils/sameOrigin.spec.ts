// @vitest-environment node
import { describe, it, expect } from 'vitest'

import '../../test/setup-server'
import { createTestEvent } from '../../test/helpers/event'

import { isSameOriginRequest } from './sameOrigin'

/**
 * The CSRF check for the admin. The test event's Host is shop.example.org.
 * What has to hold: a foreign page can never get through, whichever of the two
 * headers its browser sends; the shop's own pages and non-browser clients can.
 */
const check = (headers: Record<string, string>) =>
  isSameOriginRequest(createTestEvent({ method: 'POST', url: '/admin/api/x', headers }))

describe('isSameOriginRequest', () => {
  it.each(['same-origin', 'none'])('trusts Sec-Fetch-Site: %s', (site) => {
    expect(check({ 'sec-fetch-site': site })).toBe(true)
  })

  it.each(['cross-site', 'same-site'])('refuses Sec-Fetch-Site: %s', (site) => {
    // same-site too: shop.kooperative.de must not act in the admin of kooperative.de.
    expect(check({ 'sec-fetch-site': site })).toBe(false)
  })

  it('lets Sec-Fetch-Site win over a matching Origin', () => {
    expect(check({ 'sec-fetch-site': 'cross-site', origin: 'https://shop.example.org' })).toBe(
      false,
    )
  })

  it('accepts an Origin naming this host, whatever the scheme the proxy saw', () => {
    expect(check({ origin: 'https://shop.example.org' })).toBe(true)
    expect(check({ origin: 'http://shop.example.org' })).toBe(true)
  })

  it('refuses an Origin naming another host', () => {
    expect(check({ origin: 'https://evil.example' })).toBe(false)
    expect(check({ origin: 'https://shop.example.org.evil.example' })).toBe(false)
  })

  it('compares against the host the reverse proxy forwarded', () => {
    expect(
      check({ origin: 'https://www.example.net', 'x-forwarded-host': 'www.example.net' }),
    ).toBe(true)
  })

  it.each(['null', 'not a url'])('refuses the opaque Origin %s', (origin) => {
    expect(check({ origin })).toBe(false)
  })

  it('lets a client through that is no browser at all', () => {
    expect(check({})).toBe(true)
  })
})
