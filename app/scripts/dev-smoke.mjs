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
 * Usage (from app/):  npm run test:smoke
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.SMOKE_PORT ?? 3099)
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT ?? 180_000)

/** consola tags its lines with a padded level, e.g. "  WARN  Duplicated imports". */
const LEVEL = /(?:^|\s)(WARN|ERROR)\s/

/** See scripts/build-strict.mjs — keep this empty if you possibly can. */
const ACCEPTED = []

const child = spawn('npx', ['nuxt', 'dev', '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  // Own process group: nuxt dev spawns children that have to go down with it.
  detached: true,
  env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1' },
})

const offending = []

/** Resolves with 'ready' when the server announces its URL, or 'exited' if it dies. */
let announceReady
const readyOrExit = new Promise((resolve) => {
  announceReady = resolve
})

function watch(stream, sink) {
  let rest = ''
  stream.on('data', (chunk) => {
    sink.write(chunk)
    const lines = (rest + String(chunk)).split('\n')
    rest = lines.pop() ?? ''
    for (const line of lines) {
      if (line.includes(`localhost:${PORT}`)) announceReady('ready')
      if (!LEVEL.test(line)) continue
      if (ACCEPTED.some((a) => a.match.test(line))) continue
      offending.push(line.trim())
    }
  })
}

watch(child.stdout, process.stdout)
watch(child.stderr, process.stderr)

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

let exitCode = null
child.on('close', (code) => {
  exitCode = code ?? 1
  announceReady('exited')
})

const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS))

async function run() {
  const outcome = await Promise.race([readyOrExit, timeout])
  if (outcome === 'exited') {
    finish(exitCode === 0 ? 1 : exitCode, 'The dev server stopped before it was ready.')
    return
  }
  if (outcome === 'timeout') {
    finish(1, `The dev server did not come up within ${TIMEOUT_MS / 1000} s.`)
    return
  }

  // The first request is what actually compiles the page — a server-side error
  // in a plugin or a page only surfaces here, not while the server boots.
  let response
  try {
    response = await fetch(`http://localhost:${PORT}/`)
  } catch (error) {
    finish(1, `The dev server did not answer: ${error.message}`)
    return
  }
  if (!response.ok) {
    finish(1, `GET / answered ${response.status}.`)
    return
  }

  // Rendering happens after the response headers; let any error still land.
  await new Promise((resolve) => setTimeout(resolve, 2000))

  if (offending.length > 0) {
    finish(1, 'The dev server came up, but warnings count as failures here.')
    return
  }

  console.log(`\nDev server came up on port ${PORT}, GET / answered 200, no warnings.`)
  finish(0)
}

void run()
