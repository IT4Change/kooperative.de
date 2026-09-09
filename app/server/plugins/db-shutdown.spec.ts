// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

import '../../test/setup-server'

import plugin from './db-shutdown'

const closeDB = vi.hoisted(() => vi.fn(async () => Promise.resolve()))
vi.mock(import('../utils/db'), () => ({ closeDB, useDB: vi.fn() }))

/**
 * Closes the connection pool when Nitro shuts down. Without it a redeploy can
 * leave connections behind until the database times them out — which is how a
 * few restarts in a row exhaust max_connections.
 */
describe('db-shutdown plugin', () => {
  it('closes the pool on the close hook', async () => {
    const hooks: Record<string, () => Promise<void>> = {}
    const nitro = { hooks: { hook: (name: string, fn: () => Promise<void>) => (hooks[name] = fn) } }

    plugin(nitro as never)
    expect(hooks.close).toBeDefined()

    await hooks.close()
    expect(closeDB).toHaveBeenCalledTimes(1)
  })
})
