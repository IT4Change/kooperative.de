// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../test/setup-server'
import { createTestEvent } from '../../test/helpers/event'

import { rateLimit, resetRateLimits, trackedWindows } from './rateLimit'

import type { H3Event } from 'h3'

/**
 * The limiter's contract: a budget per key and window, a 429 with Retry-After
 * once it is used up, a fresh budget after the window — and keys that differ
 * only in case (e-mail addresses) count as one.
 */
const LIMIT = { max: 2, windowMs: 60_000 }
const T0 = 1_000_000

const retryAfter = (event: H3Event) =>
  (event.node.res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
    ([name]) => String(name).toLowerCase() === 'retry-after',
  )?.[1]

beforeEach(() => {
  resetRateLimits()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('rateLimit', () => {
  it('lets the budget through and refuses the next request with 429', () => {
    const event = createTestEvent()
    rateLimit(event, 'b', 'k', LIMIT, T0)
    rateLimit(event, 'b', 'k', LIMIT, T0 + 1)

    expect(() => {
      rateLimit(event, 'b', 'k', LIMIT, T0 + 2)
    }).toThrow(expect.objectContaining({ statusCode: 429 }))
    expect(console.warn).toHaveBeenCalledWith('[rateLimit] b exceeded (3/2)')
  })

  it.each([
    ['raises every budget by RATE_LIMIT_FACTOR', '3', 6],
    ['ignores a factor below 1', '0.5', 2],
    ['ignores a factor that is not a number', 'viel', 2],
  ])('%s', (_label, value, allowed) => {
    vi.stubEnv('RATE_LIMIT_FACTOR', value)
    const event = createTestEvent()
    for (let i = 0; i < allowed; i++) rateLimit(event, 'b', 'k', LIMIT, T0)

    expect(() => {
      rateLimit(event, 'b', 'k', LIMIT, T0)
    }).toThrow('Zu viele Anfragen')
    vi.unstubAllEnvs()
  })

  it('tells the client how long to wait', () => {
    const event = createTestEvent()
    rateLimit(event, 'b', 'k', LIMIT, T0)
    rateLimit(event, 'b', 'k', LIMIT, T0)

    expect(() => {
      rateLimit(event, 'b', 'k', LIMIT, T0 + 15_500)
    }).toThrow('Zu viele Anfragen')
    // 44.5 s left in the window, rounded up.
    expect(retryAfter(event)).toBe(45)
  })

  it('opens a fresh window once the old one has passed', () => {
    const event = createTestEvent()
    rateLimit(event, 'b', 'k', LIMIT, T0)
    rateLimit(event, 'b', 'k', LIMIT, T0)

    expect(() => {
      rateLimit(event, 'b', 'k', LIMIT, T0 + 60_000)
    }).not.toThrow('Zu viele Anfragen')
  })

  it('counts every key and every bucket on its own', () => {
    const event = createTestEvent()
    rateLimit(event, 'b', 'one', LIMIT, T0)
    rateLimit(event, 'b', 'one', LIMIT, T0)

    expect(() => {
      rateLimit(event, 'b', 'two', LIMIT, T0)
    }).not.toThrow('Zu viele Anfragen')
    expect(() => {
      rateLimit(event, 'other', 'one', LIMIT, T0)
    }).not.toThrow('Zu viele Anfragen')
  })

  it('treats an address in another case as the same key', () => {
    const event = createTestEvent()
    rateLimit(event, 'login', 'Kundin@Example.org', LIMIT, T0)
    rateLimit(event, 'login', 'kundin@example.org', LIMIT, T0)

    expect(() => {
      rateLimit(event, 'login', 'KUNDIN@EXAMPLE.ORG', LIMIT, T0)
    }).toThrow('Zu viele Anfragen')
  })

  it('counts nothing without a key', () => {
    const event = createTestEvent()
    // Behind a proxy that hides the client address there is nothing to count
    // against; the other buckets of the same request still apply.
    expect(() => {
      for (let i = 0; i < 5; i++) {
        rateLimit(event, 'b', undefined, LIMIT, T0)
        rateLimit(event, 'b', '', LIMIT, T0)
      }
    }).not.toThrow('Zu viele Anfragen')
  })

  it('drops expired windows when the table is full, so memory stays bounded', () => {
    const event = createTestEvent()
    rateLimit(event, 'login', 'still-counting', LIMIT, T0)
    for (let i = 1; i < 50_000; i++) rateLimit(event, 'flood', i, { max: 1, windowMs: 1 }, T0)
    expect(trackedWindows()).toBe(50_000)

    // The table is full; the next new key sweeps the expired windows instead
    // of growing it further — and keeps the one that is still running.
    rateLimit(event, 'flood', 'new', LIMIT, T0 + 10)
    expect(trackedWindows()).toBe(2)
    rateLimit(event, 'login', 'still-counting', LIMIT, T0 + 10)
    expect(() => {
      rateLimit(event, 'login', 'still-counting', LIMIT, T0 + 10)
    }).toThrow('Zu viele Anfragen')
  })
})
