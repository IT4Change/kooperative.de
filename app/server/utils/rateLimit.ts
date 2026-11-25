import type { H3Event } from 'h3'

/**
 * Fixed-window rate limits, kept in process memory.
 *
 * The app runs as a single Node process (pm2, see .github/webhooks), so one
 * in-memory table covers all requests; a restart resets the counters, which is
 * acceptable for limits whose job is to stop scripted bursts — credential
 * stuffing on the login, mass registrations, order floods — not to meter usage.
 * Should the app ever run as several processes, this has to move to the DB.
 *
 * RATE_LIMIT_FACTOR multiplies every budget (default 1). The E2E suite raises
 * it, because it logs in and orders far more often from 127.0.0.1 than any
 * person would; the limiter itself stays on, so its code path is exercised.
 */
export interface Limit {
  /** Requests allowed per window. */
  max: number
  windowMs: number
}

/** The limits in one place, so they can be reviewed together. */
export const LIMITS = {
  /** Per address: slows down password guessing on a single account. */
  loginPerEmail: { max: 10, windowMs: 15 * 60_000 },
  /** Per IP: slows down trying many accounts from one place. */
  loginPerIp: { max: 50, windowMs: 15 * 60_000 },
  registerPerIp: { max: 5, windowMs: 60 * 60_000 },
  /** Per customer: a household orders a few times a day, not dozens. */
  ordersPerCustomer: { max: 10, windowMs: 60 * 60_000 },
  ordersPerIp: { max: 30, windowMs: 60 * 60_000 },
} as const satisfies Record<string, Limit>

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()
/** Upper bound on tracked keys, so a flood of distinct keys cannot exhaust memory. */
const MAX_KEYS = 50_000

function factor(): number {
  const f = Number(process.env.RATE_LIMIT_FACTOR)
  return Number.isFinite(f) && f >= 1 ? f : 1
}

function sweep(now: number) {
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key)
}

/**
 * Counts one request against `bucket:key` and rejects it with 429 (and a
 * Retry-After header) once the window's budget is used up.
 */
export function rateLimit(
  event: H3Event,
  bucket: string,
  key: string | number | undefined,
  limit: Limit,
  now = Date.now(),
): void {
  // No key (e.g. no client IP behind a misconfigured proxy): nothing to count
  // against. Failing open here is deliberate — the other buckets still apply.
  if (key === undefined || key === '') return
  const id = `${bucket}:${String(key).toLowerCase()}`
  let w = windows.get(id)
  if (!w || w.resetAt <= now) {
    if (windows.size >= MAX_KEYS) sweep(now)
    w = { count: 0, resetAt: now + limit.windowMs }
    windows.set(id, w)
  }
  w.count++
  if (w.count > limit.max * factor()) {
    const retryAfter = Math.ceil((w.resetAt - now) / 1000)
    setResponseHeader(event, 'Retry-After', retryAfter)
    console.warn(`[rateLimit] ${bucket} exceeded (${w.count}/${limit.max * factor()})`)
    throw createError({
      statusCode: 429,
      statusMessage: 'Zu viele Anfragen – bitte versuchen Sie es später noch einmal',
    })
  }
}

/** For tests: how many windows are tracked. */
export function trackedWindows(): number {
  return windows.size
}

/** For tests: forget every counter. */
export function resetRateLimits(): void {
  windows.clear()
}
