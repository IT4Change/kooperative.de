import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'

const SENSITIVE_FIELDS = new Set([
  'customers_password',
  // customers table — IBAN-era columns
  'customers_banktransfer_iban_owner',
  'customers_banktransfer_iban_number',
  'customers_banktransfer_iban_bankname',
  // customers table — legacy BLZ/Konto columns
  'customers_banktransfer_owner',
  'customers_banktransfer_number',
  'customers_banktransfer_bankname',
  'customers_banktransfer_blz',
  // banktransfer_iban / banktransfer / banktransfer_blz tables — per-order snapshots
  'banktransfer_owner',
  'banktransfer_number',
  'banktransfer_bankname',
  'banktransfer_blz',
])

function maskRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = SENSITIVE_FIELDS.has(k) ? '***' : v
  }
  return out as T
}

function maskMaybeRows<T extends Record<string, unknown> | Record<string, unknown>[] | undefined>(value: T): T {
  if (value === undefined) return value
  if (Array.isArray(value)) return value.map(maskRow) as T
  return maskRow(value as Record<string, unknown>) as T
}

export interface DbWriteLogEntry {
  ts: string
  op: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  where?: Record<string, unknown>
  id?: number | string
  before?: Record<string, unknown> | Record<string, unknown>[]
  after?: Record<string, unknown>
  affected?: number
  context?: { customerId?: number, orderId?: number, remoteIp?: string }
}

let writeQueue: Promise<void> = Promise.resolve()

function logPath(): string {
  const date = new Date().toISOString().slice(0, 10)
  return join(process.cwd(), 'logs', `db-writes-${date}.jsonl`)
}

export function logDbWrite(entry: Omit<DbWriteLogEntry, 'ts'>): void {
  const full: DbWriteLogEntry = {
    ts: new Date().toISOString(),
    ...entry,
    before: maskMaybeRows(entry.before),
    after: entry.after ? maskRow(entry.after) : undefined,
  }
  const line = JSON.stringify(full) + '\n'
  writeQueue = writeQueue.then(async () => {
    const path = logPath()
    await fs.mkdir(dirname(path), { recursive: true })
    await fs.appendFile(path, line, 'utf8')
  }).catch((err) => {
    console.error('[dbWriteLog] failed to write entry:', err)
  })
}
