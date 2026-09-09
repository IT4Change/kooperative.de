// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: vi.fn() })))
vi.mock(import('nodemailer'), () => ({ createTransport }))

/**
 * The SMTP transport. Configuration is read once at module load, so each test
 * gets a fresh module registry. Worth pinning because the defaults are what a
 * misconfigured deployment falls back to.
 */
beforeEach(() => {
  createTransport.mockClear()
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getMailer', () => {
  it('builds the transport from the SMTP environment', async () => {
    vi.stubEnv('SMTP_HOST', 'mail.example.org')
    vi.stubEnv('SMTP_PORT', '587')
    vi.stubEnv('SMTP_SECURE', 'true')
    const { getMailer } = await import('./mailer')

    getMailer()

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'mail.example.org', port: 587, secure: true }),
    )
  })

  it('defaults to the local maildev container', async () => {
    vi.stubEnv('SMTP_HOST', '')
    vi.stubEnv('SMTP_PORT', '')
    vi.stubEnv('SMTP_SECURE', '')
    const { getMailer } = await import('./mailer')

    getMailer()

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 1025, secure: false }),
    )
  })

  it('adds credentials only when a user is configured', async () => {
    vi.stubEnv('SMTP_USER', '')
    const { getMailer } = await import('./mailer')

    getMailer()

    expect(createTransport.mock.calls[0][0]).not.toHaveProperty('auth')
  })

  it('passes credentials through when they are configured', async () => {
    vi.stubEnv('SMTP_USER', 'shop')
    vi.stubEnv('SMTP_PASSWORD', 'geheim')
    const { getMailer } = await import('./mailer')

    getMailer()

    expect(createTransport.mock.calls[0][0]).toMatchObject({
      auth: { user: 'shop', pass: 'geheim' },
    })
  })

  it('reuses the transport instead of opening a connection per mail', async () => {
    const { getMailer } = await import('./mailer')

    expect(getMailer()).toBe(getMailer())
    expect(createTransport).toHaveBeenCalledTimes(1)
  })
})

describe('addresses', () => {
  it('takes sender and operator from the environment', async () => {
    vi.stubEnv('MAIL_FROM', 'shop@example.org')
    vi.stubEnv('MAIL_OPERATOR', 'betrieb@example.org')
    const { MAIL_FROM, MAIL_OPERATOR } = await import('./mailer')

    expect(MAIL_FROM).toBe('shop@example.org')
    expect(MAIL_OPERATOR).toBe('betrieb@example.org')
  })

  it('falls back to the shop address', async () => {
    vi.stubEnv('MAIL_FROM', '')
    vi.stubEnv('MAIL_OPERATOR', '')
    const { MAIL_FROM, MAIL_OPERATOR } = await import('./mailer')

    expect(MAIL_FROM).toBe('shop@kooperative.de')
    expect(MAIL_OPERATOR).toBe('shop@kooperative.de')
  })
})
