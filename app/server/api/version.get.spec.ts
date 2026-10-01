// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

import '../../test/setup-server'
import { createTestEvent } from '../../test/helpers/event'

import handler from './version.get'

import type { H3Event } from 'h3'

/**
 * Reports the build's version, so a deploy can be verified from outside.
 */
vi.mock(import('#app/nuxt'), async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRuntimeConfig: () => globalThis.useRuntimeConfig(),
}))

globalThis.useRuntimeConfig = (() => ({
  public: { appVersion: '1.2.3', buildTime: '2026-10-01T12:00:00.000Z' },
})) as never

function headerOf(event: H3Event, name: string): unknown {
  const calls = (event.node.res.setHeader as ReturnType<typeof vi.fn>).mock.calls
  return calls.find(([n]) => String(n).toLowerCase() === name)?.[1]
}

describe('GET /api/version', () => {
  it('reports version and build time', () => {
    expect(handler(createTestEvent({ url: '/api/version' }))).toStrictEqual({
      version: '1.2.3',
      builtAt: '2026-10-01T12:00:00.000Z',
    })
  })

  it('must not be cached', () => {
    const event = createTestEvent({ url: '/api/version' })
    handler(event)

    expect(headerOf(event, 'cache-control')).toBe('no-store')
  })
})
