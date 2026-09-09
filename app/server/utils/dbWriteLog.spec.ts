// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { logDbWrite } from './dbWriteLog'

const mkdir = vi.hoisted(() => vi.fn(async () => Promise.resolve()))
const appendFile = vi.hoisted(() => vi.fn(async () => Promise.resolve()))
vi.mock(import('node:fs'), () => ({ promises: { mkdir, appendFile } }))

/**
 * The audit log records every database write. It is written to disk and kept
 * around, so the masking is the part that matters most: passwords and bank
 * details must never end up in it, not even inside a JSON payload column.
 *
 * Writes are queued and asynchronous — the helper below drains the queue so the
 * assertions do not race the file write.
 */
async function flush() {
  // The module chains onto a promise; two macrotask turns are enough for the
  // mkdir/appendFile pair to settle.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** The parsed JSON line the logger appended. */
function lastEntry() {
  const [, line] = appendFile.mock.calls.at(-1) as unknown as [string, string]
  return JSON.parse(line.trim())
}

beforeEach(() => {
  mkdir.mockClear()
  appendFile.mockClear()
  mkdir.mockResolvedValue(undefined)
  appendFile.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logDbWrite', () => {
  it('appends one JSON line per write, with a timestamp', async () => {
    logDbWrite({ op: 'INSERT', table: 'orders', id: 5, affected: 1 })
    await flush()

    expect(appendFile).toHaveBeenCalledTimes(1)
    const entry = lastEntry()
    expect(entry).toMatchObject({ op: 'INSERT', table: 'orders', id: 5, affected: 1 })
    expect(Date.parse(entry.ts)).not.toBeNaN()
    // One entry per line, so the file stays greppable.
    const [, line] = appendFile.mock.calls[0] as unknown as [string, string]
    expect(line.endsWith('\n')).toBe(true)
  })

  it('writes into a per-day file under logs/', async () => {
    logDbWrite({ op: 'INSERT', table: 'orders' })
    await flush()

    const [path] = appendFile.mock.calls[0] as unknown as [string]
    expect(path).toMatch(/logs\/db-writes-\d{4}-\d{2}-\d{2}\.jsonl$/)
    expect(mkdir).toHaveBeenCalledWith(expect.stringMatching(/logs$/), { recursive: true })
  })

  it('masks the password field', async () => {
    logDbWrite({
      op: 'INSERT',
      table: 'customers',
      after: { customers_firstname: 'Erika', customers_password: 'abc123:de' },
    })
    await flush()

    expect(lastEntry().after).toStrictEqual({
      customers_firstname: 'Erika',
      customers_password: '***',
    })
  })

  it.each([
    'customers_banktransfer_iban_number',
    'customers_banktransfer_number',
    'customers_banktransfer_blz',
    'banktransfer_owner',
    'banktransfer_number',
    'banktransfer_bankname',
  ])('masks %s', async (field) => {
    logDbWrite({ op: 'INSERT', table: 'banktransfer_iban', after: { [field]: 'sensitive' } })
    await flush()

    expect(lastEntry().after[field]).toBe('***')
  })

  it('redacts an IBAN hidden inside an unrelated string value', async () => {
    // The pending payload is one long JSON string — field masking cannot reach in.
    logDbWrite({
      op: 'INSERT',
      table: 'koop_pending_order',
      after: { payload: '{"iban":"DE89370400440532013000","name":"Erika"}' },
    })
    await flush()

    expect(lastEntry().after.payload).toBe('{"iban":"***IBAN***","name":"Erika"}')
  })

  it.each([
    ['an Austrian IBAN', 'AT611904300234573201'],
    ['a Swiss IBAN', 'CH9300762011623852957'],
  ])('redacts %s', async (_label, iban) => {
    logDbWrite({ op: 'UPDATE', table: 'orders', after: { note: `Konto ${iban} nutzen` } })
    await flush()

    expect(lastEntry().after.note).toBe('Konto ***IBAN*** nutzen')
  })

  it('leaves an ordinary number-like string alone', async () => {
    logDbWrite({ op: 'UPDATE', table: 'orders', after: { note: 'Bestellung DE12 ist fertig' } })
    await flush()

    expect(lastEntry().after.note).toBe('Bestellung DE12 ist fertig')
  })

  it('masks every row of a before-snapshot', async () => {
    logDbWrite({
      op: 'UPDATE',
      table: 'customers',
      before: [{ customers_password: 'a:b' }, { customers_password: 'c:d' }],
    })
    await flush()

    expect(lastEntry().before).toStrictEqual([
      { customers_password: '***' },
      { customers_password: '***' },
    ])
  })

  it('keeps an absent before-snapshot absent', async () => {
    logDbWrite({ op: 'INSERT', table: 'orders', after: { a: 1 } })
    await flush()

    expect(lastEntry().before).toBeUndefined()
  })

  it('never lets a logging failure break the write it is auditing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    appendFile.mockRejectedValueOnce(new Error('disk full'))

    // Must not reject — the order it is auditing is already committed.
    expect(() => {
      logDbWrite({ op: 'INSERT', table: 'orders' })
    }).not.toThrow()
    await flush()

    expect(error).toHaveBeenCalledWith('[dbWriteLog] failed to write entry:', expect.any(Error))
  })

  it('keeps entries in order when several writes arrive at once', async () => {
    logDbWrite({ op: 'INSERT', table: 'first' })
    logDbWrite({ op: 'INSERT', table: 'second' })
    logDbWrite({ op: 'INSERT', table: 'third' })
    await flush()

    const tables = appendFile.mock.calls.map(
      ([, line]) => JSON.parse(String(line).trim()).table as string,
    )
    expect(tables).toStrictEqual(['first', 'second', 'third'])
  })
})
