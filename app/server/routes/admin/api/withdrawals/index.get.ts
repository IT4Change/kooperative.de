/**
 * Withdrawal declarations for the admin, newest first. Read-only: handling a
 * withdrawal (return, refund, status) happens on the order itself.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
  const { total, withdrawals } = await listWithdrawals(useDB(), page, limit)
  return { total, page, limit, withdrawals }
})
