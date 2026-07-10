import type { RowDataPacket } from 'mysql2/promise'
import { getRouterParam } from 'h3'

/**
 * Full order detail for the admin (read-only): header (customer + addresses),
 * line items, totals, and the status history (with the customer_notified flag —
 * the closest the legacy schema has to a "mail sent" marker). The dedicated mail
 * timeline (koop mail log) is added in a later phase.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Bestell-ID' })
  }
  const db = useDB()

  const [headerRows] = await db.execute<RowDataPacket[]>(
    `SELECT o.*, os.orders_status_name
     FROM orders o
     LEFT JOIN orders_status os ON os.orders_status_id = o.orders_status AND os.language_id = 2
     WHERE o.orders_id = ? LIMIT 1`,
    [id],
  )
  const h = headerRows[0]
  if (!h) {
    throw createError({ statusCode: 404, statusMessage: 'Bestellung nicht gefunden' })
  }

  const [productRows] = await db.execute<RowDataPacket[]>(
    `SELECT products_id, products_model, products_name, products_price, final_price,
            products_tax, products_quantity
     FROM orders_products WHERE orders_id = ? ORDER BY orders_products_id ASC`,
    [id],
  )

  const [totalRows] = await db.execute<RowDataPacket[]>(
    `SELECT title, text, value, class, sort_order
     FROM orders_total WHERE orders_id = ? ORDER BY sort_order ASC`,
    [id],
  )

  const [historyRows] = await db.execute<RowDataPacket[]>(
    `SELECT osh.orders_status_id, osh.date_added, osh.customer_notified, osh.comments,
            os.orders_status_name
     FROM orders_status_history osh
     LEFT JOIN orders_status os ON os.orders_status_id = osh.orders_status_id AND os.language_id = 2
     WHERE osh.orders_id = ?
     ORDER BY osh.date_added ASC, osh.orders_status_history_id ASC`,
    [id],
  )

  // All statuses (German) → names for the flow + the operator's status dropdown
  const [statusRows] = await db.execute<RowDataPacket[]>(
    'SELECT orders_status_id, orders_status_name FROM orders_status WHERE language_id = 2 ORDER BY orders_status_id ASC',
  )
  const statusNames = new Map<number, string>(
    statusRows.map(r => [Number(r.orders_status_id), String(r.orders_status_name)]),
  )
  const statusFlow = buildStatusFlow(
    Number(h.orders_status),
    statusNames,
    historyRows.map(r => ({ statusId: Number(r.orders_status_id), dateAdded: r.date_added })),
  )

  // New-shop origin: if this order was materialized from a pending confirmation,
  // prepend a "Bestätigung ausstehend" (done) step and expose the confirmation info.
  let origin: 'alt' | 'neu' = 'alt'
  let confirmation: { via: string | null, at: unknown } | null = null
  try {
    const pending = await getPendingByOrderId(db, id)
    if (pending) {
      origin = 'neu'
      confirmation = { via: pending.confirmedVia, at: pending.confirmedAt }
      statusFlow.unshift({ id: -1, name: 'Bestätigung ausstehend', state: 'done', visitedAt: pending.confirmedAt as string | null })
    }
  } catch {
    // koop_pending_order may be absent on some environments
  }

  // Mail history (koop_order_mail_log). Tolerate the table being absent.
  let mails: {
    id: number, direction: string, recipient: string, mailType: string,
    relatedStatusId: number | null, subject: string, status: string,
    sentBy: string | null, createdAt: unknown,
  }[] = []
  try {
    const [mailRows] = await db.execute<RowDataPacket[]>(
      `SELECT id, direction, recipient, mail_type, related_status_id, subject, status, sent_by, created_at
       FROM koop_order_mail_log WHERE orders_id = ? ORDER BY created_at ASC, id ASC`,
      [id],
    )
    mails = mailRows.map(r => ({
      id: Number(r.id),
      direction: String(r.direction),
      recipient: String(r.recipient || ''),
      mailType: String(r.mail_type || ''),
      relatedStatusId: r.related_status_id != null ? Number(r.related_status_id) : null,
      subject: String(r.subject || ''),
      status: String(r.status),
      sentBy: r.sent_by ? String(r.sent_by) : null,
      createdAt: r.created_at,
    }))
  } catch (err) {
    console.warn('[admin/order] mail log unavailable:', (err as Error).message)
  }

  // Link to the same order in the legacy osCommerce admin (if configured). Every
  // osCommerce order (incl. materialized new-shop ones) is visible there via oID.
  const adminBase = process.env.ADMIN_BASE_URL
  const oldAdminUrl = adminBase ? `${adminBase.replace(/\/$/, '')}/orders.php?oID=${id}` : null

  return {
    statusFlow,
    origin,
    confirmation,
    oldAdminUrl,
    availableStatuses: statusRows.map(r => ({ id: Number(r.orders_status_id), name: String(r.orders_status_name) })),
    mails,
    order: {
      id: Number(h.orders_id),
      statusId: Number(h.orders_status),
      statusName: h.orders_status_name ? String(h.orders_status_name) : null,
      datePurchased: h.date_purchased,
      lastModified: h.last_modified,
      paymentMethod: String(h.payment_method || ''),
      currency: String(h.currency || 'EUR'),
      customer: {
        id: Number(h.customers_id),
        name: String(h.customers_name || ''),
        company: h.customers_company ? String(h.customers_company) : null,
        email: String(h.customers_email_address || ''),
        telephone: String(h.customers_telephone || ''),
        street: String(h.customers_street_address || ''),
        suburb: h.customers_suburb ? String(h.customers_suburb) : null,
        postcode: String(h.customers_postcode || ''),
        city: String(h.customers_city || ''),
        country: String(h.customers_country || ''),
      },
      delivery: {
        name: String(h.delivery_name || ''),
        company: h.delivery_company ? String(h.delivery_company) : null,
        street: String(h.delivery_street_address || ''),
        suburb: h.delivery_suburb ? String(h.delivery_suburb) : null,
        postcode: String(h.delivery_postcode || ''),
        city: String(h.delivery_city || ''),
        country: String(h.delivery_country || ''),
      },
    },
    products: productRows.map(r => ({
      id: Number(r.products_id),
      model: String(r.products_model || ''),
      name: String(r.products_name || ''),
      price: Number(r.products_price),
      finalPrice: Number(r.final_price),
      tax: Number(r.products_tax),
      quantity: Number(r.products_quantity),
    })),
    totals: totalRows.map(r => ({
      title: String(r.title || ''),
      text: String(r.text || ''),
      value: r.value != null ? Number(r.value) : null,
      class: String(r.class || ''),
    })),
    history: historyRows.map(r => ({
      statusId: Number(r.orders_status_id),
      statusName: r.orders_status_name ? String(r.orders_status_name) : null,
      dateAdded: r.date_added,
      customerNotified: Number(r.customer_notified) === 1,
      comments: r.comments ? String(r.comments) : '',
    })),
  }
})
