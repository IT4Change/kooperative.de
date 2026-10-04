// @vitest-environment node
import { describe, it, expect } from 'vitest'

import '../../test/setup-server'
import { createTestEvent } from '../../test/helpers/event'

import middleware from './admin-csrf'

/**
 * Cross-site requests may read nothing they could use (the browser does not hand
 * the response to the foreign page) but they could change things — so only the
 * state-changing methods in the admin are checked.
 */
const FOREIGN = { 'sec-fetch-site': 'cross-site' }

describe('admin-csrf middleware', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses a cross-site %s to the admin', (method) => {
    const event = createTestEvent({ method, url: '/admin/api/orders/5/status', headers: FOREIGN })

    expect(() => {
      middleware(event)
    }).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('passes a POST from the admin itself', () => {
    const event = createTestEvent({
      method: 'POST',
      url: '/admin/api/orders/5/status',
      headers: { 'sec-fetch-site': 'same-origin' },
    })

    expect(() => {
      middleware(event)
    }).not.toThrow()
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])('leaves a %s alone', (method) => {
    const event = createTestEvent({ method, url: '/admin/api/orders', headers: FOREIGN })

    expect(() => {
      middleware(event)
    }).not.toThrow()
  })

  it.each(['/api/orders', '/administration'])('leaves %s outside the admin alone', (url) => {
    const event = createTestEvent({ method: 'POST', url, headers: FOREIGN })

    expect(() => {
      middleware(event)
    }).not.toThrow()
  })
})
