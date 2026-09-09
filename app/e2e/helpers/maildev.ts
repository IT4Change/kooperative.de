import { expect } from '@playwright/test'

/**
 * maildev REST client. The shop's whole confirmation flow runs over mail, so the
 * suite has to read the actual messages — the confirmation link in the customer
 * mail is the only way into the review page.
 */
const API = `http://127.0.0.1:${process.env.MAILDEV_HTTP_PORT ?? 1081}`

export interface Mail {
  id: string
  subject: string
  text: string
  html: string
  to: { address: string }[]
  from: { address: string }[]
}

interface RawMail extends Omit<Mail, 'text' | 'html'> {
  text?: string
  html?: string
}

export async function allMails(): Promise<Mail[]> {
  const res = await fetch(`${API}/email`)
  if (!res.ok) throw new Error(`maildev returned ${res.status}`)
  const raw = (await res.json()) as RawMail[]
  return raw.map((m) => ({ ...m, text: m.text ?? '', html: m.html ?? '' }))
}

export async function clearMails(): Promise<void> {
  await fetch(`${API}/email/all`, { method: 'DELETE' })
}

/**
 * Mail delivery is asynchronous — the API request returns before nodemailer has
 * handed the message to maildev. Poll instead of sleeping so the suite is not
 * paced by the slowest machine it runs on.
 */
export async function waitForMail(
  match: (mail: Mail) => boolean,
  what = 'a matching mail',
): Promise<Mail> {
  await expect
    .poll(async () => (await allMails()).filter(match).length, {
      message: `waiting for ${what}`,
      timeout: 15_000,
      intervals: [200, 300, 500],
    })
    .toBeGreaterThan(0)
  return (await allMails()).filter(match).at(-1)!
}

/** Waits until exactly `count` mails match, to catch accidental duplicates too. */
export async function waitForMailCount(
  match: (mail: Mail) => boolean,
  count: number,
  what: string,
) {
  await expect
    .poll(async () => (await allMails()).filter(match).length, {
      message: `waiting for ${count} × ${what}`,
      timeout: 15_000,
      intervals: [200, 300, 500],
    })
    .toBe(count)
}

export const to = (address: string) => (mail: Mail) =>
  mail.to.some((t) => t.address.toLowerCase() === address.toLowerCase())

/** Pulls the token-gated review URL out of a confirmation-request mail. */
export function confirmationLink(mail: Mail): string {
  const match = /https?:\/\/\S*\/bestellung\/bestaetigen\?token=[A-Za-z0-9]+/.exec(mail.text)
  if (!match) throw new Error(`no confirmation link in mail "${mail.subject}"`)
  return match[0]
}
