import type { OrderComputation } from './orderCompute'
import { footerText, footerHtml } from './mailFooter'

/**
 * Mail templates for the confirmation flow. Every mail carries a link so the
 * recipient can re-check the order content: customers get the token review link,
 * the administration gets the admin detail link.
 */

const BRAND = '#00af8c'
const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!))
const money = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

function itemsText(comp: OrderComputation): string {
  const rows = comp.lines.map((l, i) =>
    `  ${i + 1}. ${l.quantity}× ${l.name}  ·  ${money(l.unitGross)}/Stk = ${money(l.lineGross)}`)
  const taxLines = comp.taxRows.map(t => `MwSt (${t.rate}%, im Preis enthalten): ${money(t.total)}`)
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
  const rows = comp.lines.map(l => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #eee">${esc(l.name)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${l.quantity}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${money(l.lineGross)}</td>
    </tr>`).join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">
    <thead><tr style="text-align:left;color:#666">
      <th style="padding:4px 6px">Artikel</th><th style="padding:4px 6px;text-align:right">Menge</th><th style="padding:4px 6px;text-align:right">Summe</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="2" style="padding:4px 6px;text-align:right">Zwischensumme</td><td style="padding:4px 6px;text-align:right">${money(comp.subtotalGross)}</td></tr>
      <tr><td colspan="2" style="padding:4px 6px;text-align:right">Versand (${esc(comp.shipping.module)})</td><td style="padding:4px 6px;text-align:right">${comp.shipping.gross > 0 ? money(comp.shipping.gross) : 'nach Aufwand'}</td></tr>
      ${comp.taxRows.map(t => `<tr><td colspan="2" style="padding:4px 6px;text-align:right;color:#888;font-size:12px">MwSt (${t.rate}%, im Preis enthalten)</td><td style="padding:4px 6px;text-align:right;color:#888;font-size:12px">${money(t.total)}</td></tr>`).join('')}
      <tr><td colspan="2" style="padding:4px 6px;text-align:right;font-weight:bold">Gesamt</td><td style="padding:4px 6px;text-align:right;font-weight:bold">${money(comp.total)}</td></tr>
    </tfoot>
  </table>
  <p style="font-size:13px;color:#555;margin:4px 0">Zahlung: <strong>${esc(comp.payment.label)}</strong></p>`
}

function wrap(title: string, inner: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#222;max-width:640px">
    <div style="background:${BRAND};color:#fff;padding:12px 16px;border-radius:8px 8px 0 0"><strong>${esc(title)}</strong></div>
    <div style="border:1px solid #ddd;border-top:0;padding:16px;border-radius:0 0 8px 8px">${inner}</div>
  </body></html>`
}

function button(url: string, label: string): string {
  return `<p style="margin:16px 0"><a href="${esc(url)}" style="background:${BRAND};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">${esc(label)}</a></p>`
}

/** Customer: please confirm your order (link → review page, or reply). */
export function buildCustomerConfirmRequest(ctx: { pendingId: number, comp: OrderComputation, reviewUrl: string }): { subject: string, text: string, html: string } {
  const c = ctx.comp
  const subject = `[Kooperative Dürnau] Bitte bestätigen Sie Ihre Bestellung`
  const greeting = c.customer.name ? `Hallo ${c.customer.name},` : 'Hallo,'
  const text = [
    greeting, '',
    'vielen Dank für Ihre Bestellung. Bitte bestätigen Sie sie verbindlich –',
    'entweder über den folgenden Link (Inhalt prüfen und bestätigen):',
    ctx.reviewUrl, '',
    'oder indem Sie einfach auf diese E-Mail antworten.', '',
    'Erst mit Ihrer Bestätigung kommt der Kaufvertrag zustande.', '',
    itemsText(c), '',
    'Herzliche Grüße', 'Kooperative Dürnau eG', '',
    footerText(true),
  ].join('\n')
  const html = wrap('Bitte bestätigen Sie Ihre Bestellung', `
    <p style="margin:0 0 12px">${esc(greeting)}</p>
    <p style="margin:0 0 4px">vielen Dank für Ihre Bestellung. Bitte bestätigen Sie sie verbindlich:</p>
    ${button(ctx.reviewUrl, 'Inhalt prüfen & bestätigen →')}
    <p style="margin:0 0 12px;color:#555">Alternativ genügt eine <strong>Antwort auf diese E-Mail</strong>. Erst mit Ihrer Bestätigung kommt der Kaufvertrag zustande.</p>
    ${itemsHtml(c)}
    <p style="margin:12px 0 0;color:#555">Herzliche Grüße<br>Kooperative Dürnau eG</p>
    ${footerHtml(true)}`)
  return { subject, text, html }
}

/** Admin: a new (unconfirmed) order has arrived. */
export function buildAdminNewPending(ctx: { pendingId: number, comp: OrderComputation, adminUrl: string }): { subject: string, text: string, html: string } {
  const c = ctx.comp
  const subject = `[Koop · neuer Shop] Neue Bestellung (unbestätigt) – ${c.customer.name}`
  const text = [
    'Eine neue Bestellung ist eingegangen und wartet auf die Bestätigung des Kunden.',
    `Kunde: ${c.customer.name} <${c.customer.email}>`,
    `Vorgang im Admin: ${ctx.adminUrl}`, '',
    itemsText(c), '',
    footerText(false),
  ].join('\n')
  const html = wrap('Neue Bestellung (unbestätigt)', `
    <p style="margin:0 0 12px">Eine neue Bestellung ist eingegangen und wartet auf die <strong>Bestätigung des Kunden</strong>.</p>
    <p style="margin:0 0 4px">Kunde: <strong>${esc(c.customer.name)}</strong> · <a href="mailto:${esc(c.customer.email)}">${esc(c.customer.email)}</a></p>
    ${button(ctx.adminUrl, 'Im Admin öffnen →')}
    ${itemsHtml(c)}
    ${footerHtml(false)}`)
  return { subject, text, html }
}

/** Customer: confirmation received (with the full order/invoice listing). */
export function buildCustomerConfirmed(ctx: { orderId: number, comp: OrderComputation, reviewUrl: string }): { subject: string, text: string, html: string } {
  const c = ctx.comp
  const subject = `[Kooperative Dürnau] Bestellung #${ctx.orderId} bestätigt`
  const greeting = c.customer.name ? `Hallo ${c.customer.name},` : 'Hallo,'
  const text = [
    greeting, '',
    `vielen Dank – wir haben Ihre Bestätigung zu Bestellung #${ctx.orderId} erhalten.`,
    'Wir bearbeiten Ihre Bestellung nun.', '',
    itemsText(c), '',
    `Bestellung ansehen: ${ctx.reviewUrl}`, '',
    'Herzliche Grüße', 'Kooperative Dürnau eG', '',
    footerText(true),
  ].join('\n')
  const html = wrap(`Bestellung #${ctx.orderId} bestätigt`, `
    <p style="margin:0 0 12px">${esc(greeting)}</p>
    <p style="margin:0 0 12px">vielen Dank – wir haben Ihre Bestätigung zu Bestellung <strong>#${ctx.orderId}</strong> erhalten und bearbeiten sie nun.</p>
    ${itemsHtml(c)}
    ${button(ctx.reviewUrl, 'Bestellung ansehen →')}
    <p style="margin:12px 0 0;color:#555">Herzliche Grüße<br>Kooperative Dürnau eG</p>
    ${footerHtml(true)}`)
  return { subject, text, html }
}

/** Admin: order confirmed, ready to process. */
export function buildAdminConfirmed(ctx: { orderId: number, comp: OrderComputation, adminUrl: string, via: string }): { subject: string, text: string, html: string } {
  const c = ctx.comp
  const subject = `[Koop · neuer Shop] Bestellung #${ctx.orderId} bestätigt – bitte bearbeiten`
  const viaLabel = ctx.via === 'admin' ? 'manuell im Admin' : ctx.via === 'reply' ? 'per Antwort' : 'per Link'
  const text = [
    `Bestellung #${ctx.orderId} wurde vom Kunden bestätigt (${viaLabel}) und kann bearbeitet werden.`,
    `Kunde: ${c.customer.name} <${c.customer.email}>`,
    `Im Admin öffnen: ${ctx.adminUrl}`, '',
    itemsText(c), '',
    footerText(false),
  ].join('\n')
  const html = wrap(`Bestellung #${ctx.orderId} bestätigt`, `
    <p style="margin:0 0 12px">Bestellung <strong>#${ctx.orderId}</strong> wurde vom Kunden bestätigt (<em>${esc(viaLabel)}</em>) und kann bearbeitet werden.</p>
    <p style="margin:0 0 4px">Kunde: <strong>${esc(c.customer.name)}</strong> · <a href="mailto:${esc(c.customer.email)}">${esc(c.customer.email)}</a></p>
    ${button(ctx.adminUrl, 'Im Admin öffnen →')}
    ${itemsHtml(c)}
    ${footerHtml(false)}`)
  return { subject, text, html }
}
