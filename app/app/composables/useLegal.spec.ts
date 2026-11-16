import { describe, it, expect, beforeEach } from 'vitest'

import { useLegal } from './useLegal'

/** One dialog for the whole app: every caller sees and moves the same state. */
describe('useLegal', () => {
  beforeEach(() => {
    useLegal().close()
  })

  it('starts closed', () => {
    const { current, isOpen } = useLegal()

    expect(current.value).toBeNull()
    expect(isOpen.value).toBe(false)
  })

  it('opens on a page and is shared between callers', () => {
    useLegal().open('agb')

    const other = useLegal()
    expect(other.current.value).toBe('agb')
    expect(other.isOpen.value).toBe(true)
  })

  it('closes again', () => {
    const legal = useLegal()
    legal.open('versand')
    legal.close()

    expect(legal.isOpen.value).toBe(false)
  })
})
