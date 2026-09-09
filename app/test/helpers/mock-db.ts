import { vi } from 'vitest'

import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'

/**
 * A stand-in for the mysql2 pool.
 *
 * The server modules take the pool as an argument (`useDB()` is only called at
 * the edge), so handing them a fake is enough to exercise everything they do
 * with it. Queries are matched by a fragment of their SQL rather than the whole
 * statement — the tests then state *which* query they are answering without
 * having to mirror formatting, and a rewritten WHERE clause does not silently
 * break unrelated specs.
 */
export interface QueryStub {
  /** Substring or pattern the SQL must contain to produce this result. */
  match: string | RegExp
  /** Rows for a SELECT, or a header for INSERT/UPDATE/DELETE. */
  rows?: unknown[]
  header?: Partial<ResultSetHeader>
  /** Rejects the call instead — for the "database is unreachable" paths. */
  error?: Error
}

export interface MockDb {
  pool: Pool
  /** Every statement the code under test issued, in order. */
  calls: { sql: string; params: unknown[] }[]
  /** The SQL of the nth statement, whitespace-collapsed for readable assertions. */
  sql: (index: number) => string
  /** Adds a stub after construction, e.g. for a second phase of a test. */
  stub: (stub: QueryStub) => void
}

const collapse = (sql: string) => sql.replace(/\s+/g, ' ').trim()

function matches(stub: QueryStub, sql: string): boolean {
  return typeof stub.match === 'string' ? sql.includes(stub.match) : stub.match.test(sql)
}

/**
 * @param stubs Checked in order; the first match wins, so put the specific ones
 *              first. An unmatched query yields an empty result rather than
 *              throwing — most handlers treat "no rows" as a valid answer, and a
 *              test that cares asserts on `calls`.
 */
export function createMockDb(stubs: QueryStub[] = []): MockDb {
  const calls: { sql: string; params: unknown[] }[] = []
  const active = [...stubs]

  const run = async (rawSql: string, params: unknown[] = []) => {
    const sql = collapse(rawSql)
    calls.push({ sql, params })

    const stub = active.find((s) => matches(s, sql))
    if (stub?.error) return Promise.reject(stub.error)
    if (stub?.header) {
      const header = { insertId: 0, affectedRows: 1, ...stub.header } as ResultSetHeader
      return Promise.resolve([header, []])
    }
    return Promise.resolve([(stub?.rows ?? []) as RowDataPacket[], []])
  }

  const pool = {
    execute: vi.fn(async (sql: string, params?: unknown[]) => run(sql, params)),
    query: vi.fn(async (sql: string, params?: unknown[]) => run(sql, params)),
    end: vi.fn(async () => Promise.resolve()),
    on: vi.fn(),
  } as unknown as Pool

  return {
    pool,
    calls,
    sql: (index) => calls[index]?.sql ?? '',
    stub: (s) => active.unshift(s),
  }
}
