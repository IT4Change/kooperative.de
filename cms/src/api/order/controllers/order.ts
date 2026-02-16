/**
 * order controller
 *
 * Custom controller that overrides the default create method to:
 * - Generate a unique order number (format: KD-YYYYMMDD-XXXX)
 * - Save the order to the database
 * - Send notification email to bestellung@kooperative.de
 * - Send confirmation email to the customer
 */

import { factories } from "@strapi/strapi";

function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `KD-${year}${month}${day}-${random}`;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " EUR";
}

function buildItemsTable(items: any[]): string {
  return items
    .map(
      (item) =>
        `- ${item.productName} (${item.sku}): ${item.quantity}x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.subtotal)}`
    )
    .join("\n");
}

export default factories.createCoreController(
  "api::order.order",
  ({ strapi }) => ({
    async create(ctx) {
      const { data } = ctx.request.body;

      if (!data) {
        return ctx.badRequest("Missing data in request body");
      }

      // Generate a unique order number
      let orderNumber: string;
      let isUnique = false;

      while (!isUnique) {
        orderNumber = generateOrderNumber();
        const existing = await strapi.documents("api::order.order").findMany({
          filters: { orderNumber },
        });
        if (existing.length === 0) {
          isUnique = true;
        }
      }

      // Inject the generated order number into the data
      data.orderNumber = orderNumber!;

      // Set default status if not provided
      if (!data.status) {
        data.status = "pending";
      }

      // Create the order entry in the database
      const entry = await strapi.documents("api::order.order").create({
        data,
      });

      // Build email content
      const itemsTable = buildItemsTable(data.items || []);
      const totalFormatted = formatCurrency(data.totalAmount);

      // Send notification email to the shop
      try {
        await strapi.plugins["email"].services.email.send({
          to: "bestellung@kooperative.de",
          subject: `Neue Bestellung: ${orderNumber!}`,
          text: `Neue Bestellung eingegangen!

Bestellnummer: ${orderNumber!}
Status: ${data.status}

Kunde:
Name: ${data.customerName}
E-Mail: ${data.customerEmail}
${data.customerPhone ? `Telefon: ${data.customerPhone}` : ""}
Adresse:
${data.customerAddress}

${data.message ? `Nachricht:\n${data.message}\n` : ""}
Bestellte Artikel:
${itemsTable}

Gesamtbetrag: ${totalFormatted}
`,
          html: `<h2>Neue Bestellung eingegangen!</h2>
<p><strong>Bestellnummer:</strong> ${orderNumber!}</p>
<p><strong>Status:</strong> ${data.status}</p>
<hr>
<h3>Kundendaten</h3>
<p><strong>Name:</strong> ${data.customerName}</p>
<p><strong>E-Mail:</strong> ${data.customerEmail}</p>
${data.customerPhone ? `<p><strong>Telefon:</strong> ${data.customerPhone}</p>` : ""}
<p><strong>Adresse:</strong><br>${data.customerAddress.replace(/\n/g, "<br>")}</p>
${data.message ? `<p><strong>Nachricht:</strong><br>${data.message.replace(/\n/g, "<br>")}</p>` : ""}
<hr>
<h3>Bestellte Artikel</h3>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
  <thead>
    <tr>
      <th>Produkt</th>
      <th>SKU</th>
      <th>Menge</th>
      <th>Einzelpreis</th>
      <th>Zwischensumme</th>
    </tr>
  </thead>
  <tbody>
    ${(data.items || [])
      .map(
        (item: any) => `
    <tr>
      <td>${item.productName}</td>
      <td>${item.sku}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>${formatCurrency(item.subtotal)}</td>
    </tr>`
      )
      .join("")}
  </tbody>
</table>
<p><strong>Gesamtbetrag: ${totalFormatted}</strong></p>`,
        });
      } catch (err) {
        strapi.log.error(
          `Failed to send order notification email for ${orderNumber!}:`,
          err
        );
      }

      // Send confirmation email to the customer
      try {
        await strapi.plugins["email"].services.email.send({
          to: data.customerEmail,
          subject: `Bestellbestätigung - ${orderNumber!} | kooperative.de`,
          text: `Liebe/r ${data.customerName},

vielen Dank für Ihre Bestellung bei kooperative.de!

Ihre Bestellnummer: ${orderNumber!}

Bestellte Artikel:
${itemsTable}

Gesamtbetrag: ${totalFormatted}

Lieferadresse:
${data.customerAddress}

Wir werden Ihre Bestellung schnellstmöglich bearbeiten und Sie über den Versand informieren.

Bei Fragen wenden Sie sich bitte an: bestellung@kooperative.de

Mit freundlichen Grüßen,
Ihr Team von kooperative.de
`,
          html: `<h2>Bestellbestätigung</h2>
<p>Liebe/r ${data.customerName},</p>
<p>vielen Dank für Ihre Bestellung bei kooperative.de!</p>
<p><strong>Ihre Bestellnummer: ${orderNumber!}</strong></p>
<hr>
<h3>Bestellte Artikel</h3>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
  <thead>
    <tr>
      <th>Produkt</th>
      <th>SKU</th>
      <th>Menge</th>
      <th>Einzelpreis</th>
      <th>Zwischensumme</th>
    </tr>
  </thead>
  <tbody>
    ${(data.items || [])
      .map(
        (item: any) => `
    <tr>
      <td>${item.productName}</td>
      <td>${item.sku}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>${formatCurrency(item.subtotal)}</td>
    </tr>`
      )
      .join("")}
  </tbody>
</table>
<p><strong>Gesamtbetrag: ${totalFormatted}</strong></p>
<hr>
<p><strong>Lieferadresse:</strong><br>${data.customerAddress.replace(/\n/g, "<br>")}</p>
<p>Wir werden Ihre Bestellung schnellstmöglich bearbeiten und Sie über den Versand informieren.</p>
<p>Bei Fragen wenden Sie sich bitte an: <a href="mailto:bestellung@kooperative.de">bestellung@kooperative.de</a></p>
<p>Mit freundlichen Grüßen,<br>Ihr Team von kooperative.de</p>`,
        });
      } catch (err) {
        strapi.log.error(
          `Failed to send order confirmation email to ${data.customerEmail} for ${orderNumber!}:`,
          err
        );
      }

      // Return the created order with the generated order number
      const sanitizedEntry = await (this as any).sanitizeOutput(entry, ctx);
      return (this as any).transformResponse(sanitizedEntry);
    },
  })
);
