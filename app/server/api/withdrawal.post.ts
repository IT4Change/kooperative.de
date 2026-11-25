import { adminOrderLink, adminWithdrawalsLink } from '../utils/links'
import { MAIL_OPERATOR } from '../utils/mailer'
import { sendAndLogOrderMail } from '../utils/orderMailLog'
import { LIMITS, rateLimit } from '../utils/rateLimit'
import { isSameOriginRequest } from '../utils/sameOrigin'
import { parseWithdrawal } from '../utils/validate'
import { recordWithdrawal } from '../utils/withdrawal'
import { buildAdminWithdrawal, buildWithdrawalReceipt } from '../utils/withdrawalMail'

/**
 * The withdrawal function's confirmation step ("Widerruf bestätigen", § 356a
 * BGB). Open without a login, for orders from both shops.
 *
 * The answer is the same whether or not the order number matched an order —
 * otherwise the form would tell anyone which numbers belong to an address. The
 * customer's receipt goes out either way; a declaration that matches nothing is
 * still a declaration and is left to the operator to assign.
 */
export default defineEventHandler(async (event) => {
  // A foreign page must not file declarations in someone else's name.
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Anfrage von fremder Seite abgelehnt' })
  }
  rateLimit(
    event,
    'withdrawal:ip',
    getRequestIP(event, { xForwardedFor: true }),
    LIMITS.withdrawalsPerIp,
  )
  const input = parseWithdrawal(await readBody(event))
  rateLimit(event, 'withdrawal:email', input.email, LIMITS.withdrawalsPerEmail)

  const db = useDB()
  const w = await recordWithdrawal(db, input)

  const receipt = buildWithdrawalReceipt(w)
  await sendAndLogOrderMail(db, {
    ordersId: w.ordersId,
    direction: 'to_customer',
    recipient: w.email,
    mailType: 'withdrawal_received',
    subject: receipt.subject,
    text: receipt.text,
    html: receipt.html,
    sentBy: 'system',
  })

  const notice = buildAdminWithdrawal(
    w,
    w.ordersId === null ? adminWithdrawalsLink(event) : adminOrderLink(event, w.ordersId),
  )
  await sendAndLogOrderMail(db, {
    ordersId: w.ordersId,
    direction: 'to_admin',
    recipient: MAIL_OPERATOR,
    mailType: 'admin_withdrawal',
    subject: notice.subject,
    text: notice.text,
    html: notice.html,
    replyTo: w.email,
    sentBy: 'system',
  })

  return { ok: true, receivedAt: w.createdAt }
})
