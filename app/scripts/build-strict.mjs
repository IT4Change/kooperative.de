/**
 * Runs the production build and treats every warning as a failure.
 *
 * Why this exists: `nuxt build` is the only step that exercises Nitro's scan of
 * server/, the auto-import registry and the Vue compiler on every page at once.
 * Whole classes of breakage are invisible to lint, typecheck and the unit suite
 * and only show up here — a spec file picked up as a Nitro plugin, two modules
 * exporting the same auto-import, a component that only fails to compile in the
 * production pipeline.
 *
 * Nuxt reports those as warnings and still exits 0, so the build alone is not a
 * gate. This wrapper makes it one: any consola WARN or ERROR line fails the run.
 *
 * Usage (from app/):  npm run test:build
 */
import { spawn } from 'node:child_process'

import { isWarnOrError, stripAnsi } from './lib/log-levels.mjs'

/**
 * Warnings that are accepted, with the reason. Keep this empty if you possibly
 * can — an entry here means the next reader has to trust that this warning is
 * still harmless. Fixing the cause is almost always cheaper than the doubt.
 */
const ACCEPTED = [
  // e.g. { match: /some unavoidable warning/, why: 'upstream bug, see #123' },
]

const child = spawn('npx', ['nuxt', 'build'], { stdio: ['inherit', 'pipe', 'pipe'] })

const offending = []

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
    }
  })
}

watch(child.stdout, process.stdout)
watch(child.stderr, process.stderr)

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`\nnuxt build exited with ${code}.`)
    process.exit(code ?? 1)
  }
  if (offending.length > 0) {
    console.error(
      `\nThe build succeeded but reported ${offending.length} warning(s), which count as failures here:\n`,
    )
    for (const line of offending) console.error(`  ${line}`)
    console.error(
      '\nFix the cause. If a warning is genuinely unavoidable, add it to ACCEPTED in' +
        ' scripts/build-strict.mjs together with the reason.',
    )
    process.exit(1)
  }
})
