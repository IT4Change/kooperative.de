// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createPool = vi.hoisted(() => vi.fn())
vi.mock(import('mysql2/promise'), () => ({ createPool }))

// useDB() reads Nuxt's runtime config, which needs an app instance that does not
// exist in a unit test. Route it to a global the tests control.
vi.mock(import('#app/nuxt'), async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRuntimeConfig: () => globalThis.useRuntimeConfig(),
}))

/**
 * The connection pool. Its settings are not cosmetic: they are the fix for the
 * hanging-shop incident, so they are pinned rather than left to drift.
 */
const RUNTIME_CONFIG = {
  db: { host: 'db.example.org', port: 3307, user: 'koop', password: 'pw', database: 'kooperative' },
}

function fakePool() {
  return { on: vi.fn(), end: vi.fn(async () => Promise.resolve()) }
}

beforeEach(() => {
  vi.resetModules()
  createPool.mockReset()
  createPool.mockImplementation(() => fakePool())
  globalThis.useRuntimeConfig = () => RUNTIME_CONFIG as never
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDB', () => {
  it('builds the pool from the runtime config', async () => {
    const { useDB } = await import('./db')

    useDB()

    expect(createPool).toHaveBeenCalledWith(expect.objectContaining(RUNTIME_CONFIG.db))
  })

  it('caps the queue so a slow database cannot hang every request', async () => {
    const { useDB } = await import('./db')

    useDB()

    // Without queueLimit, mysql2 queues forever — there is no acquire timeout.
    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionLimit: 10, queueLimit: 20, connectTimeout: 10_000 }),
    )
  })

  it('enables keep-alive so half-open sockets are noticed', async () => {
    const { useDB } = await import('./db')

    useDB()

    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({ enableKeepAlive: true, keepAliveInitialDelay: 10_000 }),
    )
  })

  it('reuses the pool across calls', async () => {
    const { useDB } = await import('./db')

    expect(useDB()).toBe(useDB())
    expect(createPool).toHaveBeenCalledTimes(1)
  })

  it('shortens net_write_timeout on every new connection', async () => {
    const pool = fakePool()
    createPool.mockReturnValue(pool)
    const { useDB } = await import('./db')

    useDB()

    // MyISAM holds the table lock while writing to a stalled client; this makes
    // the server give up instead of blocking every other reader.
    const [event, handler] = pool.on.mock.calls[0] as [string, (c: unknown) => void]
    expect(event).toBe('connection')

    const conn = { query: vi.fn() }
    handler(conn)
    expect(conn.query).toHaveBeenCalledWith(
      'SET SESSION net_write_timeout = 30',
      expect.any(Function),
    )
  })

  it('warns but carries on when that statement fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const pool = fakePool()
    createPool.mockReturnValue(pool)
    const { useDB } = await import('./db')
    useDB()

    const [, handler] = pool.on.mock.calls[0] as [string, (c: unknown) => void]
    const conn = {
      query: vi.fn((_sql: string, cb: (err: unknown) => void) => {
        cb(new Error('no privilege'))
      }),
    }
    handler(conn)

    expect(warn).toHaveBeenCalledWith('[db] could not set net_write_timeout:', expect.any(Error))
  })

  it('stays quiet when it succeeds', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const pool = fakePool()
    createPool.mockReturnValue(pool)
    const { useDB } = await import('./db')
    useDB()

    const [, handler] = pool.on.mock.calls[0] as [string, (c: unknown) => void]
    handler({
      query: vi.fn((_sql: string, cb: (err: unknown) => void) => {
        cb(null)
      }),
    })

    expect(warn).not.toHaveBeenCalled()
  })
})

describe('closeDB', () => {
  it('ends the pool and lets the next call build a fresh one', async () => {
    const first = fakePool()
    createPool.mockReturnValueOnce(first)
    const { useDB, closeDB } = await import('./db')

    useDB()
    await closeDB()

    expect(first.end).toHaveBeenCalledTimes(1)
    useDB()
    expect(createPool).toHaveBeenCalledTimes(2)
  })

  it('is a no-op when no pool was ever opened', async () => {
    const { closeDB } = await import('./db')

    await expect(closeDB()).resolves.toBeUndefined()
  })
})
