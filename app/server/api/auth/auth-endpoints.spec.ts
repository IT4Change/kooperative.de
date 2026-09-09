// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import '../../../test/setup-server'
import { callHandler, createTestEvent } from '../../../test/helpers/event'
import { createMockDb } from '../../../test/helpers/mock-db'
import { hashPassword, signSession } from '../../utils/auth'

import login from './login.post'
import logout from './logout.post'
import me from './me.get'
import register from './register.post'

const useDB = vi.hoisted(() => vi.fn())
const dbInsert = vi.hoisted(() => vi.fn())
const dbUpdate = vi.hoisted(() => vi.fn())
const dbUpdateExpr = vi.hoisted(() => vi.fn())
const dbDelete = vi.hoisted(() => vi.fn())
vi.mock(import('../../utils/dbWrite'), () => ({ dbInsert, dbUpdate, dbUpdateExpr, dbDelete }))

/**
 * The customer-facing auth endpoints. What matters beyond the happy path is
 * that a failed login says the same thing whether or not the account exists,
 * and that a half-created customer is cleaned up rather than left behind.
 */
const STORED_PASSWORD = hashPassword('supersecret')

const CUSTOMER_ROW = {
  customers_id: 3,
  customers_password: STORED_PASSWORD,
  customers_firstname: 'Erika',
  customers_lastname: 'Musterfrau',
  customers_email_address: 'kundin@example.org',
}

function useMockDb(stubs: Parameters<typeof createMockDb>[0] = []) {
  const db = createMockDb(stubs)
  useDB.mockReturnValue(db.pool)
  globalThis.useDB = useDB as never
  return db
}

const REGISTRATION = {
  gender: 'f',
  firstname: 'Neue',
  lastname: 'Kundin',
  dob: '1990-06-15',
  email: 'neu@example.org',
  telephone: '0711 999',
  password: 'ein-gutes-passwort',
  street: 'Teststraße 1',
  postcode: '70173',
  city: 'Stuttgart',
  country: 'DE',
}

beforeEach(() => {
  vi.clearAllMocks()
  dbInsert.mockResolvedValue(7)
  dbUpdate.mockResolvedValue(1)
  dbUpdateExpr.mockResolvedValue(1)
  dbDelete.mockResolvedValue(1)
})

describe('POST /api/auth/login', () => {
  it('signs the customer in and returns their name', async () => {
    useMockDb([{ match: 'FROM customers', rows: [CUSTOMER_ROW] }])

    const result = await callHandler(login, {
      method: 'POST',
      body: { email: 'kundin@example.org', password: 'supersecret' },
    })

    expect(result).toMatchObject({
      ok: true,
      customerId: 3,
      email: 'kundin@example.org',
      firstname: 'Erika',
    })
  })

  it('sets the session cookie', async () => {
    useMockDb([{ match: 'FROM customers', rows: [CUSTOMER_ROW] }])
    const event = createTestEvent({
      method: 'POST',
      body: { email: 'kundin@example.org', password: 'supersecret' },
    })

    await login(event)

    const setHeader = event.node.res.setHeader as ReturnType<typeof vi.fn>
    expect(setHeader.mock.calls.some(([n]) => String(n).toLowerCase() === 'set-cookie')).toBe(true)
  })

  it.each([
    ['a wrong password', 'kundin@example.org', 'falsch', [CUSTOMER_ROW]],
    ['an unknown address', 'niemand@example.org', 'supersecret', []],
  ])('rejects %s with the same message', async (_label, email, password, rows) => {
    useMockDb([{ match: 'FROM customers', rows }])

    // Identical wording on purpose: otherwise the endpoint becomes an oracle
    // for which addresses have an account.
    await expect(
      callHandler(login, { method: 'POST', body: { email, password } }),
    ).rejects.toMatchObject({ statusCode: 401, statusMessage: 'E-Mail oder Passwort falsch' })
  })

  it('rejects a malformed body before touching the database', async () => {
    const db = useMockDb()

    await expect(callHandler(login, { method: 'POST', body: { email: '' } })).rejects.toMatchObject(
      {
        statusCode: 400,
      },
    )
    expect(db.calls).toHaveLength(0)
  })

  it('counts the logon like the old shop did', async () => {
    useMockDb([{ match: 'FROM customers', rows: [CUSTOMER_ROW] }])

    await callHandler(login, {
      method: 'POST',
      body: { email: 'kundin@example.org', password: 'supersecret' },
      headers: { 'x-forwarded-for': '203.0.113.7' },
    })

    expect(dbUpdateExpr).toHaveBeenCalledWith(
      expect.anything(),
      'customers_info',
      { customers_info_id: 3 },
      expect.stringContaining('customers_info_number_of_logons'),
      [],
      expect.objectContaining({ customerId: 3, remoteIp: '203.0.113.7' }),
    )
  })

  it('still signs in when the logon counter cannot be written', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useMockDb([{ match: 'FROM customers', rows: [CUSTOMER_ROW] }])
    dbUpdateExpr.mockRejectedValue(new Error('table missing'))

    const result = await callHandler<{ ok: boolean }>(login, {
      method: 'POST',
      body: { email: 'kundin@example.org', password: 'supersecret' },
    })

    expect(result.ok).toBe(true)
    expect(warn).toHaveBeenCalled()
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', () => {
    const event = createTestEvent({ method: 'POST' })

    // Synchronous handler — nothing to await.
    const result = logout(event)

    expect(result).toStrictEqual({ ok: true })
    const setHeader = event.node.res.setHeader as ReturnType<typeof vi.fn>
    const cookie = setHeader.mock.calls.find(([n]) => String(n).toLowerCase() === 'set-cookie')
    expect(String(cookie?.[1])).toMatch(/koop_session=;/)
  })
})

describe('GET /api/auth/me', () => {
  it('reports an anonymous visitor', async () => {
    useMockDb()

    await expect(callHandler(me, {})).resolves.toStrictEqual({ authenticated: false })
  })

  it('returns the customer with their default address', async () => {
    useMockDb([
      {
        match: 'FROM customers c',
        rows: [
          {
            customers_id: 3,
            customers_email_address: 'kundin@example.org',
            customers_firstname: 'Erika',
            customers_lastname: 'Musterfrau',
            customers_telephone: '0711',
            entry_street_address: 'Im Winkel 11',
            entry_postcode: '88422',
            entry_city: 'Dürnau',
            entry_country_id: 81,
          },
        ],
      },
    ])
    const token = signSession({ customerId: 3, email: 'kundin@example.org' })

    const result = await callHandler(me, { headers: { cookie: `koop_session=${token}` } })

    expect(result).toMatchObject({
      authenticated: true,
      customerId: 3,
      email: 'kundin@example.org',
      address: { street: 'Im Winkel 11', postcode: '88422', city: 'Dürnau', countryId: 81 },
    })
  })

  it('clears a session whose customer no longer exists', async () => {
    useMockDb([{ match: 'FROM customers c', rows: [] }])
    const token = signSession({ customerId: 999, email: 'weg@example.org' })
    const event = createTestEvent({ headers: { cookie: `koop_session=${token}` } })

    const result = await me(event)

    // A deleted account must not keep a valid-looking session around.
    expect(result).toStrictEqual({ authenticated: false })
    const setHeader = event.node.res.setHeader as ReturnType<typeof vi.fn>
    expect(setHeader.mock.calls.some(([n]) => String(n).toLowerCase() === 'set-cookie')).toBe(true)
  })
})

describe('POST /api/auth/register', () => {
  it('creates the customer, their address and links it as default', async () => {
    useMockDb([{ match: 'SELECT customers_id', rows: [] }])
    dbInsert.mockResolvedValueOnce(7).mockResolvedValueOnce(21)

    const result = await callHandler(register, { method: 'POST', body: REGISTRATION })

    expect(result).toMatchObject({ ok: true, customerId: 7 })
    const tables = dbInsert.mock.calls.map(([, table]) => table as string)
    expect(tables).toContain('customers')
    expect(tables).toContain('address_book')
    // The address is only usable once it is pointed at from the customer row.
    expect(dbUpdate).toHaveBeenCalledWith(
      expect.anything(),
      'customers',
      { customers_id: 7 },
      { customers_default_address_id: 21 },
      expect.anything(),
    )
  })

  it('stores the password hashed, never in clear', async () => {
    useMockDb([{ match: 'SELECT customers_id', rows: [] }])

    await callHandler(register, { method: 'POST', body: REGISTRATION })

    const [, , fields] = dbInsert.mock.calls[0] as [unknown, string, Record<string, string>]
    expect(fields.customers_password).not.toContain('ein-gutes-passwort')
    expect(fields.customers_password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{2}$/)
  })

  it('maps the country to its osCommerce id', async () => {
    useMockDb([{ match: 'SELECT customers_id', rows: [] }])

    await callHandler(register, {
      method: 'POST',
      body: { ...REGISTRATION, country: 'AT' },
    })

    const address = dbInsert.mock.calls.find(([, t]) => t === 'address_book')?.[2] as Record<
      string,
      unknown
    >
    expect(address.entry_country_id).toBe(14)
  })

  it('refuses an address that is already registered', async () => {
    useMockDb([{ match: 'SELECT customers_id', rows: [{ customers_id: 3 }] }])

    await expect(
      callHandler(register, { method: 'POST', body: REGISTRATION }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(dbInsert).not.toHaveBeenCalled()
  })

  it('rejects invalid input before writing anything', async () => {
    useMockDb([{ match: 'SELECT customers_id', rows: [] }])

    await expect(
      callHandler(register, { method: 'POST', body: { ...REGISTRATION, country: 'FR' } }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(dbInsert).not.toHaveBeenCalled()
  })

  it('removes the half-created customer when the address insert fails', async () => {
    useMockDb([{ match: 'SELECT customers_id', rows: [] }])
    dbInsert.mockResolvedValueOnce(7).mockRejectedValueOnce(new Error('address_book locked'))

    await expect(callHandler(register, { method: 'POST', body: REGISTRATION })).rejects.toThrow(
      'address_book locked',
    )
    // Otherwise the address would be taken forever without an account behind it.
    expect(dbDelete).toHaveBeenCalledWith(
      expect.anything(),
      'customers',
      { customers_id: 7 },
      expect.anything(),
    )
  })
})
