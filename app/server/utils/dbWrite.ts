import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { logDbWrite } from './dbWriteLog'

type Conn = Pool | PoolConnection

const ALLOW_WRITES = process.env.ALLOW_DB_WRITES !== 'false'

function assertWritesAllowed(): void {
  if (!ALLOW_WRITES) {
    throw new Error('DB writes disabled (ALLOW_DB_WRITES=false)')
  }
}

function buildWhere(where: Record<string, unknown>): { sql: string, params: unknown[] } {
  const keys = Object.keys(where)
  if (keys.length === 0) throw new Error('refusing to operate without WHERE clause')
  const sql = keys.map(k => `\`${k}\` = ?`).join(' AND ')
  const params = keys.map(k => where[k])
  return { sql, params }
}

export interface WriteContext {
  customerId?: number
  orderId?: number
  remoteIp?: string
}

export async function dbInsert(
  conn: Conn,
  table: string,
  fields: Record<string, unknown>,
  ctx: WriteContext = {},
): Promise<number> {
  assertWritesAllowed()
  const cols = Object.keys(fields)
  if (cols.length === 0) throw new Error('refusing to INSERT empty row')
  const placeholders = cols.map(() => '?').join(', ')
  const sql = `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`
  const params = cols.map(c => fields[c])
  const [result] = await conn.execute<ResultSetHeader>(sql, params)
  const insertId = result.insertId
  logDbWrite({ op: 'INSERT', table, id: insertId, after: fields, affected: result.affectedRows, context: ctx })
  return insertId
}

export async function dbUpdate(
  conn: Conn,
  table: string,
  where: Record<string, unknown>,
  fields: Record<string, unknown>,
  ctx: WriteContext = {},
): Promise<number> {
  assertWritesAllowed()
  const cols = Object.keys(fields)
  if (cols.length === 0) throw new Error('refusing to UPDATE empty fields')
  const w = buildWhere(where)

  // Snapshot before-state for audit
  const [beforeRows] = await conn.execute<RowDataPacket[]>(
    `SELECT * FROM \`${table}\` WHERE ${w.sql}`,
    w.params,
  )

  const setSql = cols.map(c => `\`${c}\` = ?`).join(', ')
  const sql = `UPDATE \`${table}\` SET ${setSql} WHERE ${w.sql}`
  const params = [...cols.map(c => fields[c]), ...w.params]
  const [result] = await conn.execute<ResultSetHeader>(sql, params)
  logDbWrite({
    op: 'UPDATE',
    table,
    where,
    before: beforeRows as Record<string, unknown>[],
    after: fields,
    affected: result.affectedRows,
    context: ctx,
  })
  return result.affectedRows
}

/**
 * Atomic conditional UPDATE using an expression in SET (e.g. `products_ordered + ?`).
 * Captures before-state via SELECT for audit, but the UPDATE itself is single-statement atomic.
 */
export async function dbUpdateExpr(
  conn: Conn,
  table: string,
  where: Record<string, unknown>,
  setExpr: string,
  setParams: unknown[],
  ctx: WriteContext = {},
): Promise<number> {
  assertWritesAllowed()
  const w = buildWhere(where)
  const [beforeRows] = await conn.execute<RowDataPacket[]>(
    `SELECT * FROM \`${table}\` WHERE ${w.sql}`,
    w.params,
  )
  const sql = `UPDATE \`${table}\` SET ${setExpr} WHERE ${w.sql}`
  const params = [...setParams, ...w.params]
  const [result] = await conn.execute<ResultSetHeader>(sql, params)
  logDbWrite({
    op: 'UPDATE',
    table,
    where,
    before: beforeRows as Record<string, unknown>[],
    after: { _expr: setExpr, _params: setParams },
    affected: result.affectedRows,
    context: ctx,
  })
  return result.affectedRows
}

export async function dbDelete(
  conn: Conn,
  table: string,
  where: Record<string, unknown>,
  ctx: WriteContext = {},
): Promise<number> {
  assertWritesAllowed()
  const w = buildWhere(where)
  const [beforeRows] = await conn.execute<RowDataPacket[]>(
    `SELECT * FROM \`${table}\` WHERE ${w.sql}`,
    w.params,
  )
  const sql = `DELETE FROM \`${table}\` WHERE ${w.sql}`
  const [result] = await conn.execute<ResultSetHeader>(sql, w.params)
  logDbWrite({
    op: 'DELETE',
    table,
    where,
    before: beforeRows as Record<string, unknown>[],
    affected: result.affectedRows,
    context: ctx,
  })
  return result.affectedRows
}
