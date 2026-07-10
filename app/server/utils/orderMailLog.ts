import type { Pool } from 'mysql2/promise'
import { dbInsert } from './dbWrite'
import { getMailer, MAIL_FROM, MAIL_OPERATOR } from './mailer'

/**
 * Central place to send a mail that belongs to an order AND record it in
 * koop_order_mail_log, so the admin shows the complete mail history per order.
 * Sending failures are captured (status='failed') rather than thrown — the log
 * entry is written either way. The insert goes through dbInsert, so it is gated
 * by ALLOW_DB_WRITES and audited like every other write.
 */
export interface OrderMailInput {
  ordersId?: number | null
  pendingOrderId?: number | null
  direction: 'to_customer' | 'to_admin'
  recipient: string
  mailType: string
  relatedStatusId?: number | null
  subject: string
  text?: string
  html?: string
  replyTo?: string
  sentBy?: string | null
}

export async function sendAndLogOrderMail(
  db: Pool,
  mail: OrderMailInput,
  ctx: { remoteIp?: string } = {},
): Promise<{ status: 'sent' | 'failed', errorMessage: string | null }> {
  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | null = null

  try {
    await getMailer().sendMail({
      from: MAIL_FROM,
      to: mail.recipient,
      replyTo: mail.replyTo ?? MAIL_OPERATOR,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  } catch (err) {
    status = 'failed'
    errorMessage = (err instanceof Error ? err.message : String(err)).slice(0, 500)
    console.error('[orderMail] send failed:', err)
  }

  try {
    await dbInsert(db, 'koop_order_mail_log', {
      orders_id: mail.ordersId ?? null,
      pending_order_id: mail.pendingOrderId ?? null,
      direction: mail.direction,
      recipient: mail.recipient,
      mail_type: mail.mailType,
      related_status_id: mail.relatedStatusId ?? null,
      subject: mail.subject,
      body_text: mail.text ?? null,
      body_html: mail.html ?? null,
      status,
      error_message: errorMessage,
      sent_by: mail.sentBy ?? 'system',
      created_at: new Date(),
    }, { orderId: mail.ordersId ?? undefined, remoteIp: ctx.remoteIp })
  } catch (err) {
    console.error('[orderMail] log write failed:', err)
  }

  return { status, errorMessage }
}
