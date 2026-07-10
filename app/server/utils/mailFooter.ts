/**
 * Legal company footer for outgoing mails. Single source of truth — edit here.
 * Data from the app Impressum (app/pages/impressum.vue). NOTE: the legacy shop
 * mail used "Kooperative Dürnau GmbH & Co.KG" incl. a USt-ID — verify which
 * entity/USt-ID is correct for order confirmations and adjust if needed.
 */
export const COMPANY = {
  name: 'Kooperative Dürnau Verwaltungsgesellschaft mbH',
  street: 'Im Winkel 11',
  city: '88422 Dürnau',
  manager: 'Rolf Reisiger',
  register: 'Amtsgericht Ulm, HRB 650133',
  email: 'reisiger@kooperative.de',
  // ustId: 'DE… ',  // TODO: add if an Umsatzsteuer-ID should appear
}

export function footerText(withInvoiceNote = false): string {
  const lines = [
    '—',
    COMPANY.name,
    `${COMPANY.street}, ${COMPANY.city}`,
    `Geschäftsführer: ${COMPANY.manager} · ${COMPANY.register}`,
    COMPANY.email,
  ]
  if (withInvoiceNote) lines.push('', 'Diese Bestellbestätigung ist keine Rechnung.')
  return lines.join('\n')
}

export function footerHtml(withInvoiceNote = false): string {
  return `<hr style="border:0;border-top:1px solid #eee;margin:16px 0">
    <p style="font-size:11px;color:#999;line-height:1.6;margin:0">
      <strong>${COMPANY.name}</strong><br>
      ${COMPANY.street}, ${COMPANY.city}<br>
      Geschäftsführer: ${COMPANY.manager} · ${COMPANY.register}<br>
      <a href="mailto:${COMPANY.email}" style="color:#999">${COMPANY.email}</a>${withInvoiceNote ? '<br><span style="color:#bbb">Diese Bestellbestätigung ist keine Rechnung.</span>' : ''}
    </p>`
}
