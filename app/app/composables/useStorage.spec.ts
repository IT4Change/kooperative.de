import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * A guarded localStorage wrapper. The shop must stay usable when storage is
 * blocked — the head script in nuxt.config.ts installs an in-memory fallback and
 * sets `window.__storageBlocked`, and this composable turns that into a visible
 * hint instead of an exception halfway through adding to the cart.
 *
 * The module keeps its state at module level, so every test imports it fresh.
 */
async function freshStorage(blocked = false) {
  vi.resetModules()
  ;(window as unknown as { __storageBlocked?: boolean }).__storageBlocked = blocked || undefined
  const { useStorage } = await import('./useStorage')
  return useStorage()
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as { __storageBlocked?: boolean }).__storageBlocked
})

describe('when storage works', () => {
  it('reports itself available', async () => {
    const storage = await freshStorage()

    expect(storage.check()).toBe(true)
    expect(storage.available.value).toBe(true)
  })

  it('round-trips a value', async () => {
    const storage = await freshStorage()

    storage.set('kooperative-cart', '[]')

    expect(storage.get('kooperative-cart')).toBe('[]')
  })

  it('returns null for an unknown key', async () => {
    const storage = await freshStorage()

    expect(storage.get('gibtesnicht')).toBeNull()
  })

  it('removes a value', async () => {
    const storage = await freshStorage()
    storage.set('k', 'v')

    storage.remove('k')

    expect(storage.get('k')).toBeNull()
  })

  it('lets a caller proceed without a warning', async () => {
    const storage = await freshStorage()

    expect(storage.require()).toBe(true)
    expect(storage.showWarning.value).toBe(false)
  })

  it('checks only once and then caches the answer', async () => {
    const storage = await freshStorage()
    storage.check()

    // Flipping the flag afterwards must not change the cached verdict, otherwise
    // the app would flip behaviour mid-session.
    ;(window as unknown as { __storageBlocked?: boolean }).__storageBlocked = true
    expect(storage.check()).toBe(true)
  })
})

describe('when storage is blocked', () => {
  it('reports itself unavailable', async () => {
    const storage = await freshStorage(true)

    expect(storage.check()).toBe(false)
  })

  it('shows the warning when a caller needs storage', async () => {
    const storage = await freshStorage(true)

    expect(storage.require()).toBe(false)
    expect(storage.showWarning.value).toBe(true)
  })

  it('dismisses the warning again', async () => {
    const storage = await freshStorage(true)
    storage.require()

    storage.dismissWarning()

    expect(storage.showWarning.value).toBe(false)
  })

  it('reads and writes become no-ops instead of throwing', async () => {
    const storage = await freshStorage(true)

    expect(() => {
      storage.set('k', 'v')
    }).not.toThrow()
    expect(() => {
      storage.remove('k')
    }).not.toThrow()
    expect(storage.get('k')).toBeNull()
  })
})

describe('when localStorage itself throws', () => {
  it('survives a failing read', async () => {
    const storage = await freshStorage()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(storage.get('k')).toBeNull()
  })

  it('survives a full quota on write', async () => {
    const storage = await freshStorage()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    // Losing the cart is bad; throwing in the middle of adding to it is worse.
    expect(() => {
      storage.set('k', 'v')
    }).not.toThrow()
  })

  it('survives a failing removal', async () => {
    const storage = await freshStorage()
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => {
      storage.remove('k')
    }).not.toThrow()
  })
})
