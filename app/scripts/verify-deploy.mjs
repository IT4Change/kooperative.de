/**
 * Confirms after a deploy that the restarted server answers with the expected
 * version. pm2 returns before the server listens, so the endpoint is polled.
 *
 * Usage: node scripts/verify-deploy.mjs <url> [expected-version] [timeout-seconds]
 *   Without an expected version (untagged master deploy) it only reports.
 * Exits 1 when the server does not answer in time or reports another version —
 * which means the previous build is still (or again) the one serving.
 */
const [url, expected, timeoutArg] = process.argv.slice(2)
const timeoutMs = Number(timeoutArg ?? 60) * 1000
const deadline = Date.now() + timeoutMs

if (!url) {
  console.error('[verify] usage: verify-deploy.mjs <url> [expected-version] [timeout-seconds]')
  process.exit(2)
}

let lastError = 'no answer'
while (Date.now() < deadline) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (res.ok) {
      const { version, builtAt } = await res.json()
      if (!expected || version === expected) {
        console.log(`[verify] live: v${version} (built ${builtAt})`)
        process.exit(0)
      }
      lastError = `server reports v${version}, expected v${expected}`
    } else {
      lastError = `HTTP ${res.status}`
    }
  } catch (err) {
    lastError = err.cause?.code ?? err.message
  }
  await new Promise((resolve) => setTimeout(resolve, 2000))
}

console.error(`[verify] deploy not confirmed after ${timeoutMs / 1000}s: ${lastError}`)
process.exit(1)
