/**
 * Starts the dev server, fetches a page, and fails on any warning.
 *
 * Why this exists in addition to the production build: the two pipelines are not
 * the same, and dev is the stricter of the two. A spec file that Nitro picks up
 * as a server plugin aborts `nuxt dev` with a Rollup error, while `nuxt build`
 * quietly tree-shakes it away and produces a working artefact — so the build is
 * green while nobody can start the app. That is exactly the shape of breakage
 * that has to be caught before a merge, not after a checkout.
 *
 * Readiness is decided by asking the port, never by reading the output: Nuxt
 * colours the URL it prints, and in CI the port carries its own escape sequence
 * ("localhost:\x1b[1m3099\x1b[22m"), so matching on the text is a trap. The log
 * is still scanned for warnings — see lib/log-levels.mjs for why that needs care.
 *
 * Usage (from app/):  npm run test:smoke
 */
import { spawn } from 'node:child_process'

import { isError, isWarnOrError, stripAnsi } from './lib/log-levels.mjs'

const PORT = Number(process.env.SMOKE_PORT ?? 3099)
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT ?? 180_000)
const POLL_MS = 500
/**
 * Each attempt is bounded: when Nitro dies, Vite still accepts the connection
 * and simply never answers. Without this the very first request would hang in
 * undici's 300 s default and the loop would never look at `fatal` again.
 */
const ATTEMPT_MS = 5000

/** See scripts/build-strict.mjs — keep this empty if you possibly can. */
const ACCEPTED = []

const child = spawn('npx', ['nuxt', 'dev', '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  // Own process group: nuxt dev spawns children that have to go down with it.
  detached: true,
  env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1' },
})

const offending = []
let fatal = null
let exitCode = null

/** Streams the output through untouched so CI logs stay readable, and scans it. */
function watch(stream, sink) {
  let rest = ''
  stream.on('data', (chunk) => {
    sink.write(chunk)
    const lines = (rest + String(chunk)).split('\n')
    rest = lines.pop() ?? ''
    for (const line of lines) {
      if (!isWarnOrError(line)) continue
      const plain = stripAnsi(line).trim()
      if (ACCEPTED.some((a) => a.match.test(plain))) continue
      offending.push(plain)
      // An error while starting means the server will not come up healthy. Nuxt
      // keeps the Vite process alive even when Nitro died, so without this the
      // run would sit out the whole timeout for a failure it already knows about.
      if (isError(line)) fatal ??= plain
    }
  })
}

watch(child.stdout, process.stdout)
watch(child.stderr, process.stderr)

child.on('close', (code) => {
  exitCode = code ?? 1
})

/** Takes the whole process group down, so no dev server survives the run. */
function stopServer() {
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    // already gone
  }
}

function finish(code, message) {
  if (message) console.error(`\n${message}`)
  // Whatever went wrong, the WARN/ERROR lines are the useful part — repeat them
  // at the end so the cause is the last thing in the CI log, not the symptom.
  if (code !== 0 && offending.length > 0) {
    console.error(`\nThe server reported ${offending.length} warning(s) or error(s):\n`)
    for (const line of offending) console.error(`  ${line}`)
    console.error('\nFix the cause, or add it to ACCEPTED in scripts/dev-smoke.mjs with a reason.')
  }
  stopServer()
  // Give the group a moment to die before the runner tears the job down.
  setTimeout(() => process.exit(code), 500)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Asks the port until it answers. The first request is also what compiles the
 * page, so a server-side error in a plugin or a page surfaces here rather than
 * while the server boots.
 */
async function waitForServer() {
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    if (fatal) return { ok: false, why: 'The dev server reported an error while starting.' }
    if (exitCode !== null) return { ok: false, why: 'The dev server stopped before it was ready.' }
    try {
      const response = await fetch(`http://localhost:${PORT}/`, {
        signal: AbortSignal.timeout(ATTEMPT_MS),
      })
      if (response.ok) return { ok: true }
      return { ok: false, why: `GET / answered ${response.status}.` }
    } catch {
      // Not listening yet — that is the normal case for most of this loop.
    }
    await sleep(POLL_MS)
  }
  return { ok: false, why: `The dev server did not answer within ${TIMEOUT_MS / 1000} s.` }
}

async function run() {
  const result = await waitForServer()
  if (!result.ok) {
    finish(exitCode !== null && exitCode !== 0 ? exitCode : 1, result.why)
    return
  }

  // Rendering happens after the response headers; let any error still land.
  await sleep(2000)

  if (offending.length > 0) {
    finish(1, 'The dev server came up, but warnings count as failures here.')
    return
  }

  console.log(`\nDev server came up on port ${PORT}, GET / answered 200, no warnings.`)
  finish(0)
}

void run()
