import type { Page } from '@playwright/test'

export interface ApiResult {
  status: number
  ok: boolean
  data: unknown
}

/**
 * Calls the app's API from inside the page.
 *
 * Not via Playwright's request context on purpose: the session cookie is marked
 * Secure in a production build. Chromium treats 127.0.0.1 as a secure origin and
 * keeps it; the standalone request context drops it, so every follow-up call
 * would look logged out. Running the fetch in the page uses the real browser
 * cookie semantics — the same ones a customer's browser applies.
 *
 * The page must already be on the app's origin.
 */
export async function api(
  page: Page,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<ApiResult> {
  return page.evaluate(
    async (args) => {
      const res = await fetch(args.path, {
        method: args.method,
        headers: args.body == null ? {} : { 'content-type': 'application/json' },
        body: args.body == null ? undefined : JSON.stringify(args.body),
      })
      // Error responses are JSON too, but a 204 or an HTML error page is not.
      const data = await res.json().catch(() => null)
      return { status: res.status, ok: res.ok, data }
    },
    { method, path, body },
  )
}
