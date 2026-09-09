// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createMockDb } from '../../test/helpers/mock-db'

const logDbWrite = vi.hoisted(() => vi.fn())
vi.mock(import('./dbWriteLog'), () => ({ logDbWrite }))

/**
 * Every write the shop performs goes through these four functions, including the
 * ones that touch the live osCommerce tables. Two properties matter beyond the
 * generated SQL: the read-only switch has to hold, and every change has to reach
 * the audit log with its before-state.
 *
 * ALLOW_DB_WRITES is read once at module load, so the guard is exercised in its
 * own isolated module registry rather than by mutating the environment mid-test.
 */
describe('dbWrite', () => {
  beforeEach(() => {
    logDbWrite.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('dbInsert', () => {
    it('builds a parameterised INSERT and returns the new id', async () => {
      const { dbInsert } = await import('./dbWrite')
      const db = createMockDb([{ match: 'INSERT INTO', header: { insertId: 42 } }])

      const id = await dbInsert(db.pool, 'customers', { customers_firstname: 'Erika', rechnung: 0 })

      expect(id).toBe(42)
      expect(db.sql(0)).toBe(
        'INSERT INTO `customers` (`customers_firstname`, `rechnung`) VALUES (?, ?)',
      )
      expect(db.calls[0].params).toStrictEqual(['Erika', 0])
    })

    it('records the insert in the audit log', async () => {
      const { dbInsert } = await import('./dbWrite')
      const db = createMockDb([{ match: 'INSERT INTO', header: { insertId: 7, affectedRows: 1 } }])

      await dbInsert(db.pool, 'orders', { customers_id: 3 }, { orderId: 9, remoteIp: '10.0.0.1' })

      expect(logDbWrite).toHaveBeenCalledWith({
        op: 'INSERT',
        table: 'orders',
        id: 7,
        after: { customers_id: 3 },
        affected: 1,
        context: { orderId: 9, remoteIp: '10.0.0.1' },
      })
    })

    it('refuses an empty row rather than emitting invalid SQL', async () => {
      const { dbInsert } = await import('./dbWrite')
      const db = createMockDb()

      await expect(dbInsert(db.pool, 'customers', {})).rejects.toThrow('refusing to INSERT')
      expect(db.calls).toHaveLength(0)
    })
  })

  describe('dbUpdate', () => {
    it('snapshots the previous rows before changing them', async () => {
      const { dbUpdate } = await import('./dbWrite')
      const before = [{ orders_status: 1 }]
      const db = createMockDb([
        { match: 'SELECT *', rows: before },
        { match: 'UPDATE', header: { affectedRows: 1 } },
      ])

      const affected = await dbUpdate(db.pool, 'orders', { orders_id: 5 }, { orders_status: 3 })

      expect(affected).toBe(1)
      // The SELECT has to come first, otherwise the audit log records the new state.
      expect(db.sql(0)).toBe('SELECT * FROM `orders` WHERE `orders_id` = ?')
      expect(db.sql(1)).toBe('UPDATE `orders` SET `orders_status` = ? WHERE `orders_id` = ?')
      expect(db.calls[1].params).toStrictEqual([3, 5])
      expect(logDbWrite).toHaveBeenCalledWith(expect.objectContaining({ before }))
    })

    it('combines several WHERE columns with AND', async () => {
      const { dbUpdate } = await import('./dbWrite')
      const db = createMockDb([{ match: 'UPDATE', header: { affectedRows: 2 } }])

      await dbUpdate(db.pool, 'products', { products_id: 1, language_id: 2 }, { products_price: 9 })

      expect(db.sql(1)).toBe(
        'UPDATE `products` SET `products_price` = ? WHERE `products_id` = ? AND `language_id` = ?',
      )
      expect(db.calls[1].params).toStrictEqual([9, 1, 2])
    })

    it('refuses to update without any field', async () => {
      const { dbUpdate } = await import('./dbWrite')
      const db = createMockDb()

      await expect(dbUpdate(db.pool, 'orders', { orders_id: 1 }, {})).rejects.toThrow(
        'refusing to UPDATE',
      )
    })

    it('refuses to update without a WHERE clause', async () => {
      const { dbUpdate } = await import('./dbWrite')
      const db = createMockDb()

      // Would rewrite the whole table — the guard exists for exactly this.
      await expect(dbUpdate(db.pool, 'orders', {}, { orders_status: 3 })).rejects.toThrow(
        'refusing to operate without WHERE',
      )
    })
  })

  describe('dbUpdateExpr', () => {
    it('puts the expression into SET and keeps the parameter order', async () => {
      const { dbUpdateExpr } = await import('./dbWrite')
      const db = createMockDb([{ match: 'UPDATE', header: { affectedRows: 1 } }])

      await dbUpdateExpr(
        db.pool,
        'products',
        { products_id: 4 },
        'products_ordered = products_ordered + ?',
        [2],
      )

      expect(db.sql(1)).toBe(
        'UPDATE `products` SET products_ordered = products_ordered + ? WHERE `products_id` = ?',
      )
      // Expression parameters first, then the WHERE values.
      expect(db.calls[1].params).toStrictEqual([2, 4])
    })

    it('logs the expression instead of a row snapshot of the new values', async () => {
      const { dbUpdateExpr } = await import('./dbWrite')
      const db = createMockDb([{ match: 'UPDATE', header: { affectedRows: 1 } }])

      await dbUpdateExpr(db.pool, 'products', { products_id: 4 }, 'x = x + ?', [1])

      expect(logDbWrite).toHaveBeenCalledWith(
        expect.objectContaining({ after: { _expr: 'x = x + ?', _params: [1] } }),
      )
    })

    it('refuses to operate without a WHERE clause', async () => {
      const { dbUpdateExpr } = await import('./dbWrite')
      const db = createMockDb()

      await expect(dbUpdateExpr(db.pool, 'products', {}, 'x = x + ?', [1])).rejects.toThrow(
        'refusing to operate without WHERE',
      )
    })
  })

  describe('dbDelete', () => {
    it('snapshots the rows it removes', async () => {
      const { dbDelete } = await import('./dbWrite')
      const before = [{ customers_id: 8 }]
      const db = createMockDb([
        { match: 'SELECT *', rows: before },
        { match: 'DELETE', header: { affectedRows: 1 } },
      ])

      const affected = await dbDelete(db.pool, 'customers', { customers_id: 8 })

      expect(affected).toBe(1)
      expect(db.sql(1)).toBe('DELETE FROM `customers` WHERE `customers_id` = ?')
      expect(logDbWrite).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'DELETE', table: 'customers', before }),
      )
    })

    it('refuses to operate without a WHERE clause', async () => {
      const { dbDelete } = await import('./dbWrite')
      const db = createMockDb()

      await expect(dbDelete(db.pool, 'customers', {})).rejects.toThrow(
        'refusing to operate without WHERE',
      )
    })
  })

  describe('read-only mode', () => {
    /** ALLOW_DB_WRITES is captured at import time, so the module has to be re-imported. */
    async function readOnlyModule() {
      vi.stubEnv('ALLOW_DB_WRITES', 'false')
      vi.resetModules()
      return import('./dbWrite')
    }

    it('blocks every write when ALLOW_DB_WRITES is false', async () => {
      const { dbInsert, dbUpdate, dbUpdateExpr, dbDelete } = await readOnlyModule()
      const db = createMockDb()

      for (const call of [
        async () => dbInsert(db.pool, 't', { a: 1 }),
        async () => dbUpdate(db.pool, 't', { id: 1 }, { a: 1 }),
        async () => dbUpdateExpr(db.pool, 't', { id: 1 }, 'a = a + ?', [1]),
        async () => dbDelete(db.pool, 't', { id: 1 }),
      ]) {
        await expect(call()).rejects.toThrow('DB writes disabled')
      }
      // Nothing reached the database, not even the audit SELECT.
      expect(db.calls).toHaveLength(0)
    })

    it('allows writes for any other value', async () => {
      vi.stubEnv('ALLOW_DB_WRITES', 'true')
      vi.resetModules()
      const { dbInsert } = await import('./dbWrite')
      const db = createMockDb([{ match: 'INSERT', header: { insertId: 1 } }])

      await expect(dbInsert(db.pool, 't', { a: 1 })).resolves.toBe(1)
    })
  })
})
