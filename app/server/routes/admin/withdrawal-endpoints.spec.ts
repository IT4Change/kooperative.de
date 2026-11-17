// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../../test/setup-server'
import { callHandler } from '../../../test/helpers/event'
import { createMockDb } from '../../../test/helpers/mock-db'

import withdrawalList from './api/withdrawals/index.get'

/** The admin list reads listWithdrawals through Nitro's auto-import. */
const listWithdrawals = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  const db = createMockDb()
  Object.assign(globalThis, { useDB: () => db.pool, listWithdrawals })
  listWithdrawals.mockResolvedValue({ total: 1, withdrawals: [{ id: 3 }] })
})

describe('GET /admin/api/withdrawals', () => {
  it('pages the list', async () => {
    const result = await callHandler(withdrawalList, {
      url: '/admin/api/withdrawals?page=2&limit=20',
    })

    expect(result).toStrictEqual({ total: 1, page: 2, limit: 20, withdrawals: [{ id: 3 }] })
    expect(listWithdrawals).toHaveBeenCalledWith(expect.anything(), 2, 20)
  })

  it('falls back to sane paging for garbage input', async () => {
    await callHandler(withdrawalList, { url: '/admin/api/withdrawals?page=-4&limit=100000' })

    expect(listWithdrawals).toHaveBeenCalledWith(expect.anything(), 1, 200)
  })

  it('defaults to the first page of 50', async () => {
    await callHandler(withdrawalList, { url: '/admin/api/withdrawals' })

    expect(listWithdrawals).toHaveBeenCalledWith(expect.anything(), 1, 50)
  })
})
