import { footerHtml, footerText } from './mailFooter'
import { esc, wrap } from './pendingMail'

import type { Withdrawal } from './withdrawal'

/**
 * Mails for a withdrawal declaration (§ 356a BGB): the receipt the customer is
 * owed without delay — with the declaration's content and the date and time it
 * arrived, on a durable medium — and the notice to the operator.
 */

/** German local time: the customer reads "eingegangen am …" in Dürnau terms. */
export function receivedAt(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${date} um ${time} Uhr`
}

/** The declaration as it was made, line by line. */
function content(w: Withdrawal): [label: string, value: string][] {
  return [
    ['Name', w.name],
    ['E-Mail', w.email],
    ['Bestellung', w.orderRef],
    ['Umfang', w.scope === 'all' ? 'gesamte Bestellung' : 'einzelne Artikel'],
    ...(w.items ? ([['Artikel', w.items]] as [string, string][]) : []),
    ...(w.message ? ([['Nachricht', w.message]] as [string, string][]) : []),
  ]
}

const contentText = (w: Withdrawal) => content(w).map(([k, v]) => `${k}: ${v}`)

function contentHtml(w: Withdrawal): string {
  const rows = content(w)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px 4px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;font-size:14px;margin:8px 0">${rows}</table>`
}

export function buildWithdrawalReceipt(w: Withdrawal): {
  subject: string
  text: string
  html: string
} {
  const at = receivedAt(w.createdAt)
  const subject = `[Kooperative Dürnau] Eingang Ihres Widerrufs zu Bestellung ${w.orderRef}`
  const greeting = `Hallo ${w.name},`
  const lead = `Ihr Widerruf ist am ${at} bei uns eingegangen. Sie haben Folgendes erklärt:`
  const next =
    'Wir melden uns zur Rücksendung und Erstattung bei Ihnen. Bitte bewahren Sie diese E-Mail auf.'
  const text = [
    greeting,
    '',
    lead,
    '',
    ...contentText(w),
    '',
    next,
    '',
    'Herzliche Grüsze',
    'Kooperative Dürnau eG',
    '',
    footerText(),
  ].join('\n')
  const html = wrap(
    'Eingang Ihres Widerrufs',
    `
    <p style="margin:0 0 12px">${esc(greeting)}</p>
    <p style="margin:0 0 12px">${esc(lead)}</p>
    ${contentHtml(w)}
    <p style="margin:12px 0 0;color:#555">${esc(next)}</p>
    <p style="margin:12px 0 0;color:#555">Herzliche Grüsze<br>Kooperative Dürnau eG</p>
    ${footerHtml()}`,
  )
  return { subject, text, html }
}

export function buildAdminWithdrawal(
  w: Withdrawal,
  adminUrl: string,
): { subject: string; text: string; html: string } {
  const at = receivedAt(w.createdAt)
  const subject = `[Koop · neuer Shop] Widerruf zu Bestellung ${w.orderRef} – bitte bearbeiten`
  const matched = w.ordersId !== null
  const headline = `Am ${at} ist ein Widerruf eingegangen.`
  const link = matched
    ? `Zugeordnet zu Bestellung #${w.ordersId}.`
    : 'Bestellnummer und E-Mail-Adresse passen zu keiner Bestellung – bitte von Hand zuordnen.'
  const text = [
    headline,
    link,
    `Im Admin öffnen: ${adminUrl}`,
    '',
    ...contentText(w),
    '',
    footerText(),
  ].join('\n')
  const html = wrap(
    'Widerruf eingegangen',
    `
    <p style="margin:0 0 12px">${esc(headline)}</p>
    <p style="margin:0 0 12px">${esc(link)}</p>
    <p style="margin:0 0 12px"><a href="${esc(adminUrl)}">Im Admin öffnen →</a></p>
    ${contentHtml(w)}
    ${footerHtml()}`,
  )
  return { subject, text, html }
}
