import { footerText, footerHtml } from './mailFooter'

import type { ContractTerm } from './contractTerms'
import type { OrderComputation } from './orderCompute'

/**
 * Mail templates for new-shop orders: the receipt of a direct order, and the
 * confirmed / released mails that finish orders still placed under the former
 * confirmation flow. Every mail carries a link so the recipient can re-check
 * the order content: customers get the token review link, the administration
 * gets the admin detail link.
 */

const BRAND = '#00af8c'
export const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
const money = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

function itemsText(comp: OrderComputation): string {
  const rows = comp.lines.map(
    (l, i) =>
      `  ${i + 1}. ${l.quantity}× ${l.name}  ·  ${money(l.unitGross)}/Stk = ${money(l.lineGross)}`,
  )
  const taxLines = comp.taxRows.map(
    (t) => `MwSt (${t.rate}%, im Preis enthalten): ${money(t.total)}`,
  )
  return [
    'Positionen:',
    ...rows,
    `Zwischensumme: ${money(comp.subtotalGross)}`,
    `Versand (${comp.shipping.module}): ${comp.shipping.gross > 0 ? money(comp.shipping.gross) : 'nach Aufwand'}`,
    ...taxLines,
    `Gesamt: ${money(comp.total)}`,
    `Zahlung: ${comp.payment.label}`,
  ].join('\n')
}

function itemsHtml(comp: OrderComputation): string {
  const rows = comp.lines
    .map(
      (l) => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #eee">${esc(l.name)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${l.quantity}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${money(l.lineGross)}</td>
    </tr>`,
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">
    <thead><tr style="text-align:left;color:#666">
      <th style="padding:4px 6px">Artikel</th><th style="padding:4px 6px;text-align:right">Menge</th><th style="padding:4px 6px;text-align:right">Summe</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="2" style="padding:4px 6px;text-align:right">Zwischensumme</td><td style="padding:4px 6px;text-align:right">${money(comp.subtotalGross)}</td></tr>
      <tr><td colspan="2" style="padding:4px 6px;text-align:right">Versand (${esc(comp.shipping.module)})</td><td style="padding:4px 6px;text-align:right">${comp.shipping.gross > 0 ? money(comp.shipping.gross) : 'nach Aufwand'}</td></tr>
      ${comp.taxRows.map((t) => `<tr><td colspan="2" style="padding:4px 6px;text-align:right;color:#888;font-size:12px">MwSt (${t.rate}%, im Preis enthalten)</td><td style="padding:4px 6px;text-align:right;color:#888;font-size:12px">${money(t.total)}</td></tr>`).join('')}
      <tr><td colspan="2" style="padding:4px 6px;text-align:right;font-weight:bold">Gesamt</td><td style="padding:4px 6px;text-align:right;font-weight:bold">${money(comp.total)}</td></tr>
    </tfoot>
  </table>
  <p style="font-size:13px;color:#555;margin:4px 0">Zahlung: <strong>${esc(comp.payment.label)}</strong></p>`
}

export function wrap(title: string, inner: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#222;max-width:640px">
    <div style="background:${BRAND};color:#fff;padding:12px 16px;border-radius:8px 8px 0 0"><strong>${esc(title)}</strong></div>
    <div style="border:1px solid #ddd;border-top:0;padding:16px;border-radius:0 0 8px 8px">${inner}</div>
  </body></html>`
}

function button(url: string, label: string): string {
  return `<p style="margin:16px 0"><a href="${esc(url)}" style="background:${BRAND};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">${esc(label)}</a></p>`
}

const TERMS_INTRO =
  'Für Ihre Bestellung gelten die folgenden Bedingungen. Bitte bewahren Sie diese ' +
  'E-Mail auf – sie ist Ihre Kopie des Vertragstextes.'

/** The contract terms as the mail's closing section (§ 312f Abs. 2 BGB). */
function termsText(terms: readonly ContractTerm[]): string {
  if (terms.length === 0) return ''
  const parts = terms.map(
    (t) => `==== ${t.title} (Fassung ${t.versionNo}) ====\n\n${t.text.trim()}`,
  )
  return ['', '', TERMS_INTRO, '', ...parts.flatMap((p) => [p, ''])].join('\n').trimEnd()
}

function termsHtml(terms: readonly ContractTerm[]): string {
  if (terms.length === 0) return ''
  const parts = terms
    .map(
      (t) => `
    <section style="margin:16px 0 0">
      <h2 style="font-size:15px;margin:0 0 8px">${esc(t.title)} <span style="font-weight:normal;color:#888">(Fassung ${t.versionNo})</span></h2>
      ${t.html}
    </section>`,
    )
    .join('')
  return `<hr style="border:0;border-top:1px solid #eee;margin:16px 0">
    <div style="font-size:12px;color:#444;line-height:1.5">
    <p style="margin:0 0 8px">${esc(TERMS_INTRO)}</p>${parts}
    </div>`
}

/** Customer: confirmation received (with the full order/invoice listing). */
export function buildCustomerConfirmed(ctx: {
  orderId: number
  comp: OrderComputation
  reviewUrl: string
}): { subject: string; text: string; html: string } {
  const c = ctx.comp
  const subject = `[Kooperative Dürnau] Bestellung #${ctx.orderId} bestätigt`
  const greeting = c.customer.name ? `Hallo ${c.customer.name},` : 'Hallo,'
  const text = [
    greeting,
    '',
    `vielen Dank – wir haben Ihre Bestätigung zu Bestellung #${ctx.orderId} erhalten.`,
    'Wir bearbeiten Ihre Bestellung nun.',
    '',
    itemsText(c),
    '',
    `Bestellung ansehen: ${ctx.reviewUrl}`,
    '',
    'Herzliche Grüsze',
    'Kooperative Dürnau eG',
    '',
    footerText(true),
  ].join('\n')
  const html = wrap(
    `Bestellung #${ctx.orderId} bestätigt`,
    `
    <p style="margin:0 0 12px">${esc(greeting)}</p>
    <p style="margin:0 0 12px">vielen Dank – wir haben Ihre Bestätigung zu Bestellung <strong>#${ctx.orderId}</strong> erhalten und bearbeiten sie nun.</p>
    ${itemsHtml(c)}
    ${button(ctx.reviewUrl, 'Bestellung ansehen →')}
    <p style="margin:12px 0 0;color:#555">Herzliche Grüsze<br>Kooperative Dürnau eG</p>
    ${footerHtml(true)}`,
  )
  return { subject, text, html }
}

/** Admin: order confirmed, ready to process. */
export function buildAdminConfirmed(ctx: {
  orderId: number
  comp: OrderComputation
  adminUrl: string
  via: string
  /** Reason for a manual release; only set for via='admin'. */
  note?: string
}): { subject: string; text: string; html: string } {
  const c = ctx.comp
  const subject = `[Koop · neuer Shop] Bestellung #${ctx.orderId} bestätigt – bitte bearbeiten`
  // A manual release did not come from the customer, so it does not claim to:
  // saying "vom Kunden bestätigt (manuell im Admin)" would misreport who acted.
  const manual = ctx.via === 'admin'
  const viaLabel = manual ? 'manuell im Admin' : ctx.via === 'reply' ? 'per Antwort' : 'per Link'
  const headline = manual
    ? `Bestellung #${ctx.orderId} wurde ${viaLabel} freigegeben und kann bearbeitet werden.`
    : `Bestellung #${ctx.orderId} wurde vom Kunden bestätigt (${viaLabel}) und kann bearbeitet werden.`
  const text = [
    headline,
    ...(ctx.note ? [`Begründung: ${ctx.note}`] : []),
    `Kunde: ${c.customer.name} <${c.customer.email}>`,
    `Im Admin öffnen: ${ctx.adminUrl}`,
    '',
    itemsText(c),
    '',
    footerText(false),
  ].join('\n')
  const html = wrap(
    `Bestellung #${ctx.orderId} bestätigt`,
    `
    <p style="margin:0 0 12px">${esc(headline)}</p>
    ${ctx.note ? `<p style="margin:0 0 12px">Begründung: <em>${esc(ctx.note)}</em></p>` : ''}
    <p style="margin:0 0 4px">Kunde: <strong>${esc(c.customer.name)}</strong> · <a href="mailto:${esc(c.customer.email)}">${esc(c.customer.email)}</a></p>
    ${button(ctx.adminUrl, 'Im Admin öffnen →')}
    ${itemsHtml(c)}
    ${footerHtml(false)}`,
  )
  return { subject, text, html }
}

/**
 * Customer: receipt of a direct order (§ 312i Abs. 1 Nr. 3 BGB).
 * Deliberately NOT an acceptance — the contract is concluded by a separate order
 * confirmation or by shipping (AGB § 2), so the shop can still decline, e.g.
 * when an item is out of stock.
 */
export function buildCustomerOrderReceived(ctx: {
  orderId: number
  comp: OrderComputation
  reviewUrl: string
  /** AGB and Widerrufsbelehrung as live at the time of the order. */
  terms?: readonly ContractTerm[]
}): { subject: string; text: string; html: string } {
  const c = ctx.comp
  const subject = `[Kooperative Dürnau] Eingang Ihrer Bestellung #${ctx.orderId}`
  const greeting = c.customer.name ? `Hallo ${c.customer.name},` : 'Hallo,'
  const receipt =
    'Diese E-Mail bestätigt nur den Eingang Ihrer Bestellung und ist noch keine Annahme. ' +
    'Der Kaufvertrag kommt zustande, wenn wir Ihre Bestellung mit einer Auftragsbestätigung ' +
    'annehmen oder die Ware versenden.'
  const text =
    [
      greeting,
      '',
      `vielen Dank für Ihre Bestellung #${ctx.orderId}. Sie ist bei uns eingegangen.`,
      '',
      receipt,
      '',
      itemsText(c),
      '',
      `Bestellung ansehen: ${ctx.reviewUrl}`,
      ...(ctx.withdrawalUrl ? [`Vertrag widerrufen: ${ctx.withdrawalUrl}`] : []),
      '',
      'Herzliche Grüsze',
      'Kooperative Dürnau eG',
      '',
      footerText(true),
    ].join('\n') + termsText(ctx.terms ?? [])
  const html = wrap(
    `Eingang Ihrer Bestellung #${ctx.orderId}`,
    `
    <p style="margin:0 0 12px">${esc(greeting)}</p>
    <p style="margin:0 0 12px">vielen Dank für Ihre Bestellung <strong>#${ctx.orderId}</strong>. Sie ist bei uns eingegangen.</p>
    <p style="margin:0 0 12px;color:#555">${esc(receipt)}</p>
    ${itemsHtml(c)}
    ${button(ctx.reviewUrl, 'Bestellung ansehen →')}${ctx.withdrawalUrl ? `<p style="margin:0;font-size:12px"><a href="${esc(ctx.withdrawalUrl)}" style="color:#888">Vertrag widerrufen</a></p>` : ''}
    <p style="margin:12px 0 0;color:#555">Herzliche Grüsze<br>Kooperative Dürnau eG</p>
    ${footerHtml(true)}${termsHtml(ctx.terms ?? [])}`,
  )
  return { subject, text, html }
}

/** Admin: a new direct order has arrived and is ready to process. */
export function buildAdminNewOrder(ctx: {
  orderId: number
  comp: OrderComputation
  adminUrl: string
}): { subject: string; text: string; html: string } {
  const c = ctx.comp
  const subject = `[Koop · neuer Shop] Neue Bestellung #${ctx.orderId} – bitte bearbeiten`
  const headline = `Neue Bestellung #${ctx.orderId} ist eingegangen und kann bearbeitet werden.`
  const text = [
    headline,
    `Kunde: ${c.customer.name} <${c.customer.email}>`,
    `Im Admin öffnen: ${ctx.adminUrl}`,
    '',
    itemsText(c),
    '',
    footerText(false),
  ].join('\n')
  const html = wrap(
    `Neue Bestellung #${ctx.orderId}`,
    `
    <p style="margin:0 0 12px">${esc(headline)}</p>
    <p style="margin:0 0 4px">Kunde: <strong>${esc(c.customer.name)}</strong> · <a href="mailto:${esc(c.customer.email)}">${esc(c.customer.email)}</a></p>
    ${button(ctx.adminUrl, 'Im Admin öffnen →')}
    ${itemsHtml(c)}
    ${footerHtml(false)}`,
  )
  return { subject, text, html }
}
