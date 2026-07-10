import { footerText, footerHtml } from './mailFooter'

/**
 * Customer-facing status notification mail. Sent from MAIL_FROM
 * (shop@kooperative.de) with Reply-To the operator, so the customer can simply
 * reply. Kept plain and friendly; German (project content language).
 */
export interface StatusMailContext {
  orderId: number
  customerName: string
  statusName: string
  comment?: string
}

export function buildStatusMail(ctx: StatusMailContext): { subject: string, text: string, html: string } {
  const subject = `[Kooperative Dürnau] Bestellung #${ctx.orderId} – ${ctx.statusName}`
  const greeting = ctx.customerName ? `Hallo ${ctx.customerName},` : 'Hallo,'

  const text = [
    greeting,
    '',
    `der Status Ihrer Bestellung #${ctx.orderId} lautet nun: ${ctx.statusName}.`,
    ctx.comment ? `\nAnmerkung:\n${ctx.comment}` : '',
    '',
    'Bei Fragen antworten Sie einfach auf diese E-Mail.',
    '',
    'Herzliche Grüße',
    'Kooperative Dürnau eG',
    '',
    footerText(false),
  ].filter(l => l !== null).join('\n')

  const escape = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!))
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#222;max-width:640px">
    <div style="background:#00af8c;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0">
      <strong>Kooperative Dürnau</strong> · Bestellung <strong>#${ctx.orderId}</strong>
    </div>
    <div style="border:1px solid #ddd;border-top:0;padding:16px;border-radius:0 0 8px 8px">
      <p style="margin:0 0 12px">${escape(greeting)}</p>
      <p style="margin:0 0 12px">der Status Ihrer Bestellung <strong>#${ctx.orderId}</strong> lautet nun:
        <strong>${escape(ctx.statusName)}</strong>.</p>
      ${ctx.comment ? `<p style="margin:0 0 12px;white-space:pre-wrap"><em>${escape(ctx.comment)}</em></p>` : ''}
      <p style="margin:0 0 12px;color:#555">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
      <p style="margin:0 0 12px;color:#555">Herzliche Grüße<br>Kooperative Dürnau eG</p>
      ${footerHtml(false)}
    </div>
  </body></html>`

  return { subject, text, html }
}
