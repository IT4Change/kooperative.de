/**
 * Aborts long-running queries on the configured database server.
 *
 * Companion to scripts/db-doctor.mjs: the doctor diagnoses a saturated server,
 * this one clears the pile-up. Uses the same DB_* env as the Nuxt app (loads
 * app/.env like scripts/migrate.mjs), so it always targets the server the app
 * actually talks to.
 *
 * Safety model — this kills work on a production database, so:
 *   • DRY RUN by default; nothing is killed without --kill.
 *   • KILL QUERY, not KILL CONNECTION — the statement is aborted, the client's
 *     connection survives and can carry on.
 *   • Only SELECTs. Writes (INSERT/UPDATE/DELETE/ALTER) are listed but skipped
 *     unless --include-writes, because aborting them triggers a rollback that
 *     can take longer than the statement itself.
 *   • Only threads at least --min-age seconds old (default 300).
 *   • Only the configured database, unless --all-dbs.
 *   • Never this script's own thread.
 *   • --max-kills caps a single pass (default 100).
 *
 * Usage (from app/):
 *   node scripts/kill-long-queries.mjs                        # dry run, show what would die
 *   node scripts/kill-long-queries.mjs --kill                 # actually abort them
 *   node scripts/kill-long-queries.mjs --kill --min-age 60
 *   node scripts/kill-long-queries.mjs --kill --match 'count\(distinct p.products_id\)'
 *   node scripts/kill-long-queries.mjs --kill --loop --interval 60   # janitor, Ctrl-C to stop
 *
 * Exit codes: 0 = ran fine, 1 = connection/permission problem, 3 = usage error.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createConnection } from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')

// ---------------------------------------------------------------- env / args

// Same loader as scripts/migrate.mjs — credentials cannot drift from the app's.
const envPath = join(appRoot, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)

const CFG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'koop',
  password: process.env.DB_PASSWORD || 'koop',
  database: process.env.DB_DATABASE || 'kooperative',
}

const DO_KILL = flag('kill')
// KILL QUERY only takes effect where the thread reaches a kill checkpoint. A
// thread stuck in "Sending to client" (blocked writing to a client that does
// not read) never gets there — only closing the connection clears it.
const HARD = flag('connection')
const MIN_AGE = Number(arg('min-age', 300))
const MAX_KILLS = Number(arg('max-kills', 100))
const ALL_DBS = flag('all-dbs')
const INCLUDE_WRITES = flag('include-writes')
const LOOP = flag('loop')
const INTERVAL = Number(arg('interval', 60)) * 1000
const MATCH = arg('match', '')

if (!Number.isFinite(MIN_AGE) || MIN_AGE < 0) {
  console.error('--min-age must be a non-negative number of seconds')
  process.exit(3)
}
if (MIN_AGE < 10 && !flag('force')) {
  console.error(
    `--min-age ${MIN_AGE}s would abort ordinary short queries too. Pass --force if you mean it.`,
  )
  process.exit(3)
}
let matcher = null
if (MATCH) {
  try {
    matcher = new RegExp(MATCH, 'i')
  } catch (err) {
    console.error(`--match is not a valid regular expression: ${err.message}`)
    process.exit(3)
  }
}

// ------------------------------------------------------------------ plumbing

const WRITE_RE =
  /^\s*(insert|update|delete|replace|alter|drop|create|truncate|rename|grant|revoke|load\s+data)\b/i
const SELECT_RE = /^\s*(select|with|show|explain)\b/i

const oneLine = (s) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
const age = (t) =>
  t >= 3600 ? `${(t / 3600).toFixed(1)}h` : t >= 60 ? `${(t / 60).toFixed(0)}m` : `${t}s`
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

/** Threads that are candidates for killing, plus the ones we deliberately spare. */
async function findCandidates(conn) {
  const [rows] = await conn.query(
    `SELECT id, user, host, db, command, time, state, info
       FROM information_schema.processlist
      WHERE command NOT IN ('Sleep', 'Daemon', 'Binlog Dump', 'Binlog Dump GTID')
        AND id <> CONNECTION_ID()
        AND time >= ?
      ORDER BY time DESC`,
    [MIN_AGE],
  )

  const kill = []
  const spared = []
  for (const r of rows) {
    const sql = oneLine(r.info)
    const skip = (reason) => spared.push({ ...r, sql, reason })

    if (!ALL_DBS && r.db && r.db !== CFG.database) skip(`other database (${r.db})`)
    else if (!sql) skip(`no statement text (${r.command}/${r.state || '-'})`)
    else if (WRITE_RE.test(sql) && !INCLUDE_WRITES) skip('write statement — rollback risk')
    else if (!SELECT_RE.test(sql) && !INCLUDE_WRITES) skip('not a plain read')
    else if (matcher && !matcher.test(sql)) skip('does not match --match')
    else kill.push({ ...r, sql })
  }
  return { kill, spared, scanned: rows.length }
}

async function pass(conn) {
  const { kill, spared, scanned } = await findCandidates(conn)

  console.log(
    `\n[${stamp()}] ${scanned} active thread(s) older than ${MIN_AGE}s — ${kill.length} to abort, ${spared.length} spared`,
  )

  for (const t of spared) {
    console.log(`  · skip  id=${String(t.id).padEnd(9)} ${age(t.time).padStart(6)}  ${t.reason}`)
  }
  if (!kill.length) {
    console.log('  nothing to do.')
    return 0
  }

  const targets = kill.slice(0, MAX_KILLS)
  if (kill.length > targets.length) {
    console.log(
      `  (capped at --max-kills ${MAX_KILLS}; ${kill.length - targets.length} left for the next pass)`,
    )
  }

  let killed = 0
  for (const t of targets) {
    const label = `id=${String(t.id).padEnd(9)} ${age(t.time).padStart(6)} ${(t.state || '-').padEnd(16)} ${t.sql.slice(0, 90)}`
    if (!DO_KILL) {
      console.log(`  ~ would kill ${label}`)
      continue
    }
    try {
      await conn.query(`KILL ${HARD ? 'CONNECTION' : 'QUERY'} ${Number(t.id)}`)
      killed++
      console.log(`  ✓ killed     ${label}`)
    } catch (err) {
      // ER_NO_SUCH_THREAD is normal: the query finished between listing and kill.
      const gone = err.errno === 1094
      console.log(
        `  ${gone ? '·' : '✗'} ${gone ? 'gone       ' : 'FAILED     '} ${label}${gone ? '' : ` — ${err.code || err.message}`}`,
      )
      if (!gone && err.errno === 1095) {
        console.log(
          '      → not our thread and no PROCESS/SUPER privilege — cannot kill it from here',
        )
      }
    }
  }

  if (!DO_KILL) {
    console.log(
      `  DRY RUN — nothing was aborted. Re-run with --kill to actually abort these ${targets.length}.`,
    )
    return 0
  }

  // "KILL accepted" is not "thread gone". Verify, because a thread blocked in a
  // socket write survives KILL QUERY while happily reporting success.
  await new Promise((r) => setTimeout(r, 1500))
  const [still] = await conn.query(
    `SELECT id, time, state FROM information_schema.processlist WHERE id IN (?)`,
    [targets.map((t) => Number(t.id))],
  )
  if (!still.length) {
    console.log(`  aborted ${killed}/${targets.length}, all gone.`)
    return killed
  }

  console.log(`  ✗ ${still.length}/${targets.length} thread(s) SURVIVED the kill:`)
  for (const t of still) {
    console.log(
      `      id=${String(t.id).padEnd(9)} still ${age(t.time).padStart(6)} in "${t.state || '-'}"`,
    )
  }
  if (!HARD) {
    console.log('      → KILL QUERY cannot stop a thread that is blocked writing to its client.')
    console.log('      → Re-run with --connection to close those connections instead.')
  } else {
    console.log('      → even KILL CONNECTION did not clear them; the server is waiting on a dead')
    console.log('        socket (half-open connection). Restart the client application.')
  }
  return killed
}

// ---------------------------------------------------------------------- main

console.log('=== kooperative.de — long query killer ===')
console.log(`target : ${CFG.user}@${CFG.host}:${CFG.port}/${CFG.database}`)
console.log(
  `mode   : ${DO_KILL ? 'KILL' : 'dry run'}${LOOP ? `, loop every ${INTERVAL / 1000}s` : ''}`,
)
console.log(
  `filter : age >= ${MIN_AGE}s, ${ALL_DBS ? 'all databases' : `database ${CFG.database}`}, ` +
    `${INCLUDE_WRITES ? 'reads and writes' : 'reads only'}${matcher ? `, matching /${MATCH}/i` : ''}`,
)

let conn
try {
  conn = await createConnection({ ...CFG, connectTimeout: 10000 })
} catch (err) {
  console.error(`\ncannot connect: ${err.code || ''} ${err.message}`)
  process.exit(1)
}

let stopping = false
process.on('SIGINT', () => {
  stopping = true
  console.log('\ninterrupted — finishing current pass and exiting.')
})

try {
  do {
    await pass(conn)
    if (LOOP && !stopping) await new Promise((r) => setTimeout(r, INTERVAL))
    // `stopping` is flipped by the SIGINT handler above, which ESLint cannot see;
    // `LOOP` is a fixed CLI flag that turns the single pass into a watch loop.
    // eslint-disable-next-line no-unmodified-loop-condition
  } while (LOOP && !stopping)
} catch (err) {
  console.error(`\naborted: ${err.code || ''} ${err.message}`)
  await conn.end().catch(() => {})
  process.exit(1)
}

await conn.end().catch(() => {})
process.exit(0)
