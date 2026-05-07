import { COUNTRY_IDS } from './countries'

export interface OrderMailContext {
  orderId: number
  customer: {
    customerId: number
    firstname: string
    lastname: string
    email: string
    telephone: string
  }
  shipping: {
    street: string
    postcode: string
    city: string
    country: string
  }
  items: {
    productId: string
    name: string
    variantSize?: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }[]
  total: number
  notes?: string
  adminBaseUrl?: string
}

export function buildOrderMail(ctx: OrderMailContext): { subject: string, text: string, html: string, replyTo: string } {
  const subject = `[Koop · neuer Shop] Bestellung #${ctx.orderId} – ${ctx.customer.firstname} ${ctx.customer.lastname}`

  const adminLink = ctx.adminBaseUrl
    ? `${ctx.adminBaseUrl.replace(/\/$/, '')}/orders.php?oID=${ctx.orderId}`
    : null

  const text = [
    `Neue Bestellung über den neuen Shop`,
    `Bestell-Nr.: ${ctx.orderId}`,
    adminLink ? `Admin-Link: ${adminLink}` : '',
    '',
    `Kunde:`,
    `  ${ctx.customer.firstname} ${ctx.customer.lastname}`,
    `  ${ctx.customer.email}`,
    `  Tel.: ${ctx.customer.telephone || '–'}`,
    `  Kunden-Nr.: ${ctx.customer.customerId}`,
    '',
    `Lieferadresse:`,
    `  ${ctx.shipping.street}`,
    `  ${ctx.shipping.postcode} ${ctx.shipping.city}`,
    `  ${ctx.shipping.country}`,
    '',
    `Positionen:`,
    ...ctx.items.map((it, i) =>
      `  ${i + 1}. ${it.quantity}× ${it.name}${it.variantSize ? ` (${it.variantSize})` : ''}` +
      `  ·  ${it.unitPrice.toFixed(2)} €/Stk  =  ${it.lineTotal.toFixed(2)} €`,
    ),
    '',
    `Gesamt: ${ctx.total.toFixed(2)} €`,
    ctx.notes ? `\nAnmerkungen:\n${ctx.notes}` : '',
  ].filter(Boolean).join('\n')

  const escape = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!))
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#222;max-width:640px">
    <div style="background:#00af8c;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0">
      <strong>Neuer Shop</strong> · Bestellung <strong>#${ctx.orderId}</strong>
    </div>
    <div style="border:1px solid #ddd;border-top:0;padding:16px;border-radius:0 0 8px 8px">
      ${adminLink ? `<p style="margin:0 0 12px"><a href="${escape(adminLink)}">Im Admin öffnen →</a></p>` : ''}
      <h3 style="margin:12px 0 4px">Kunde</h3>
      <p style="margin:0">
        ${escape(ctx.customer.firstname)} ${escape(ctx.customer.lastname)} (Kunden-Nr. ${ctx.customer.customerId})<br>
        <a href="mailto:${escape(ctx.customer.email)}">${escape(ctx.customer.email)}</a>
        ${ctx.customer.telephone ? ` · Tel. ${escape(ctx.customer.telephone)}` : ''}
      </p>
      <h3 style="margin:12px 0 4px">Lieferadresse</h3>
      <p style="margin:0">
        ${escape(ctx.shipping.street)}<br>
        ${escape(ctx.shipping.postcode)} ${escape(ctx.shipping.city)}<br>
        ${escape(ctx.shipping.country)}
      </p>
      <h3 style="margin:16px 0 4px">Positionen</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f6f6f6;text-align:left">
          <th style="padding:6px;border-bottom:1px solid #ddd">#</th>
          <th style="padding:6px;border-bottom:1px solid #ddd">Artikel</th>
          <th style="padding:6px;border-bottom:1px solid #ddd;text-align:right">Menge</th>
          <th style="padding:6px;border-bottom:1px solid #ddd;text-align:right">Einzel</th>
          <th style="padding:6px;border-bottom:1px solid #ddd;text-align:right">Summe</th>
        </tr></thead>
        <tbody>
        ${ctx.items.map((it, i) => `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #eee">${i + 1}</td>
            <td style="padding:6px;border-bottom:1px solid #eee">${escape(it.name)}${it.variantSize ? ` <span style="color:#888">(${escape(it.variantSize)})</span>` : ''}</td>
            <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${it.quantity}</td>
            <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${it.unitPrice.toFixed(2)} €</td>
            <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${it.lineTotal.toFixed(2)} €</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="4" style="padding:6px;text-align:right;font-weight:bold">Gesamt</td>
          <td style="padding:6px;text-align:right;font-weight:bold">${ctx.total.toFixed(2)} €</td>
        </tr></tfoot>
      </table>
      ${ctx.notes ? `<h3 style="margin:16px 0 4px">Anmerkungen</h3><p style="margin:0;white-space:pre-wrap">${escape(ctx.notes)}</p>` : ''}
    </div>
  </body></html>`

  return { subject, text, html, replyTo: ctx.customer.email }
}

export function countryName(countryId: number): string {
  for (const v of Object.values(COUNTRY_IDS)) {
    if (v.id === countryId) return v.name
  }
  return ''
}
