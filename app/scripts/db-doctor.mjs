#!/usr/bin/env node
/**
 * DB connectivity / latency doctor.
 *
 * Answers one question: is /shop timing out because the database is
 * unreachable, or because it answers but too slowly / with too few free
 * connections? Uses the *same* DB_* env as the Nuxt app (loads app/.env like
 * scripts/migrate.mjs) and the *same* catalog queries as server/utils/catalog.ts.
 *
 * Every layer is measured separately so the failure can be pinned down:
 *   1 DNS        — name resolves?
 *   2 TCP        — port reachable? (refused vs. silently dropped)
 *   3 Handshake  — MySQL auth ok? (credentials / max_connections)
 *   4 Ping       — round-trip latency of a trivial query
 *   5 Server     — Threads_connected vs. max_connections, longest running query
 *   6 Catalog    — the two real /api/products queries, with row counts
 *   7 Pool       — 10 concurrent catalog loads through a pool configured
 *                  exactly like the app's (connectionLimit: 10)
 *   8 HTTP       — optional probe of the running app's /api/products
 *
 * Usage (from app/):
 *   node scripts/db-doctor.mjs
 *   node scripts/db-doctor.mjs --concurrency 20 --url http://127.0.0.1:3000
 *
 * Exit codes: 0 = healthy, 1 = DB unreachable/auth failure, 2 = DB reachable
 * but degraded (slow or saturated), 3 = script/usage error.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import dns from 'node:dns/promises'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')

// ---------------------------------------------------------------- env / args

// Load app/.env into process.env without overriding already-set vars —
// identical to scripts/migrate.mjs, so credentials cannot drift from the app's.
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
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const CFG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'koop',
  password: process.env.DB_PASSWORD || 'koop',
  database: process.env.DB_DATABASE || 'kooperative',
}
const CONCURRENCY = Number(arg('concurrency', 10))
const STEP_TIMEOUT = Number(arg('timeout', 15000)) // ms per step, no step may hang
const APP_URL = arg('url', '')
const SKIP_LOAD = process.argv.includes('--skip-load')
const FORCE_LOAD = process.argv.includes('--force-load')

// ------------------------------------------------------------------ plumbing

const findings = []
let saturated = false // server is thrashing → later steps must not pile on
let catalogFailed = false
const t0 = process.hrtime.bigint()
const ms = start => Number(process.hrtime.bigint() - start) / 1e6
const fmt = n => `${n.toFixed(0)} ms`

function step(n, title) {
  console.log(`\n[${n}] ${title}`)
}
function ok(msg) {
  console.log(`    ✓ ${msg}`)
}
function warn(msg) {
  console.log(`    ! ${msg}`)
  findings.push({ level: 'warn', msg })
}
function fail(msg) {
  console.log(`    ✗ ${msg}`)
  findings.push({ level: 'fail', msg })
}

/** Reject after `limit` ms so a hung socket cannot stall the whole run. */
function withTimeout(promise, limit, label) {
  let timer
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${limit} ms (no answer)`)), limit)
  })
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer))
}

/** Abandon a query server-side after the client stopped waiting for it. */
async function killOwnQuery(threadId, label) {
  if (!threadId) return
  let killer
  try {
    killer = await mysql.createConnection({ ...CFG, connectTimeout: 5000 })
    await killer.query(`KILL QUERY ${Number(threadId)}`)
    console.log(`      → killed the abandoned ${label} server-side (thread ${threadId})`)
  } catch (err) {
    console.log(`      → could NOT kill thread ${threadId} (${err.code || err.message}); it keeps running`)
  } finally {
    await killer?.end().catch(() => {})
  }
}

// The catalog queries, mirrored from server/utils/catalog.ts. Kept verbatim so
// a slow plan here means a slow plan in /api/products.
const Q_CATEGORIES = `
  SELECT c.categories_id, c.parent_id, c.sort_order, cd.categories_name
  FROM categories c
  JOIN categories_description cd ON c.categories_id = cd.categories_id AND cd.language_id = 2
  ORDER BY c.parent_id, c.sort_order, cd.categories_name
`
const Q_PRODUCTS = `
  SELECT p.products_id, p.products_price, p.products_model,
         p.products_image,
         p.products_image_detail_1, p.products_image_detail_2, p.products_image_detail_3,
         p.products_image_detail_4, p.products_image_detail_5,
         p.products_status, p.products_tax_class_id, p.products_date_added,
         COALESCE(tr.tax_rate, 0) AS tax_rate,
         pd.products_name, pd.products_description, pd.products_description2,
         pd.products_content, pd.products_sizes, pd.products_viewed,
         pd.products_head_title_tag, pd.products_head_desc_tag, pd.products_head_keywords_tag,
         ptc.categories_id AS category_id, cd.categories_name AS category_name
  FROM products p
  JOIN products_description pd ON p.products_id = pd.products_id AND pd.language_id = 2
  LEFT JOIN products_to_categories ptc ON p.products_id = ptc.products_id
  LEFT JOIN categories_description cd ON ptc.categories_id = cd.categories_id AND cd.language_id = 2
  LEFT JOIN tax_rates tr ON p.products_tax_class_id = tr.tax_class_id
  WHERE p.products_status = 1
  GROUP BY p.products_id
  ORDER BY pd.products_name
`

console.log('=== kooperative.de — DB doctor ===')
console.log(`target : ${CFG.user}@${CFG.host}:${CFG.port}/${CFG.database}`)
console.log(`env    : ${existsSync(envPath) ? envPath : 'process env only (no app/.env)'}`)
console.log(`node   : ${process.version} on ${process.platform}`)

// ------------------------------------------------------------------ 1) DNS

step(1, 'DNS resolution')
let addresses = []
if (net.isIP(CFG.host)) {
  addresses = [CFG.host]
  ok(`host is a literal IP (${CFG.host}) — no lookup needed`)
} else {
  const s = process.hrtime.bigint()
  try {
    const res = await withTimeout(dns.lookup(CFG.host, { all: true }), STEP_TIMEOUT, 'DNS lookup')
    addresses = res.map(r => r.address)
    ok(`${CFG.host} → ${addresses.join(', ')} (${fmt(ms(s))})`)
  } catch (err) {
    fail(`cannot resolve ${CFG.host}: ${err.message}`)
  }
}

// ------------------------------------------------------------------ 2) TCP

step(2, 'TCP reachability (raw socket, no MySQL protocol)')
let tcpOk = false
{
  const s = process.hrtime.bigint()
  const outcome = await new Promise((resolve) => {
    const sock = net.connect({ host: CFG.host, port: CFG.port })
    sock.setTimeout(STEP_TIMEOUT)
    sock.once('connect', () => { sock.destroy(); resolve({ kind: 'connected' }) })
    sock.once('timeout', () => { sock.destroy(); resolve({ kind: 'timeout' }) })
    sock.once('error', err => resolve({ kind: 'error', code: err.code, message: err.message }))
  })
  if (outcome.kind === 'connected') {
    tcpOk = true
    ok(`port ${CFG.port} accepts connections (${fmt(ms(s))})`)
  } else if (outcome.kind === 'timeout') {
    fail(`no SYN-ACK within ${STEP_TIMEOUT} ms — packets are being dropped (firewall / host down / wrong host)`)
  } else if (outcome.code === 'ECONNREFUSED') {
    fail('connection refused — nothing is listening on that port (DB process down?)')
  } else {
    fail(`socket error ${outcome.code}: ${outcome.message}`)
  }
}

// ------------------------------------------------- 3-6) MySQL-level checks

let conn = null
let handshakeOk = false

if (tcpOk) {
  step(3, 'MySQL handshake + authentication (app credentials)')
  const s = process.hrtime.bigint()
  try {
    conn = await withTimeout(
      mysql.createConnection({ ...CFG, connectTimeout: STEP_TIMEOUT }),
      STEP_TIMEOUT + 2000,
      'handshake',
    )
    handshakeOk = true
    ok(`authenticated as ${CFG.user} on ${CFG.database} (${fmt(ms(s))})`)
  } catch (err) {
    const hint = {
      ER_ACCESS_DENIED_ERROR: 'wrong user/password — credentials in .env do not match the DB',
      ER_DBACCESS_DENIED_ERROR: `user ${CFG.user} may not use database ${CFG.database}`,
      ER_BAD_DB_ERROR: `database ${CFG.database} does not exist`,
      ER_CON_COUNT_ERROR: 'max_connections reached — DB is saturated, not down',
      ER_HOST_IS_BLOCKED: 'host blocked after too many aborted connects (needs FLUSH HOSTS)',
      PROTOCOL_CONNECTION_LOST: 'server closed the connection during handshake',
      ETIMEDOUT: 'handshake started but never completed — server accepts TCP but does not answer',
    }[err.code]
    fail(`handshake failed (${err.code || 'no code'}) after ${fmt(ms(s))}: ${err.message}${hint ? `\n      → ${hint}` : ''}`)
  }
}

if (handshakeOk) {
  step(4, 'Query round-trip (SELECT 1)')
  const samples = []
  try {
    for (let i = 0; i < 5; i++) {
      const s = process.hrtime.bigint()
      await withTimeout(conn.query('SELECT 1'), STEP_TIMEOUT, 'SELECT 1')
      samples.push(ms(s))
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    const max = Math.max(...samples)
    if (max > 500) warn(`round-trip slow: avg ${fmt(avg)}, max ${fmt(max)} — the server itself is loaded`)
    else ok(`avg ${fmt(avg)}, max ${fmt(max)}`)
  } catch (err) {
    fail(`SELECT 1 failed: ${err.message}`)
  }

  step(5, 'Server state (connections, load, long-running queries)')
  try {
    const [status] = await withTimeout(
      conn.query(`SHOW GLOBAL STATUS WHERE Variable_name IN
        ('Threads_connected','Threads_running','Max_used_connections','Aborted_connects','Uptime','Slow_queries')`),
      STEP_TIMEOUT, 'SHOW GLOBAL STATUS',
    )
    const [vars] = await conn.query(
      `SHOW GLOBAL VARIABLES WHERE Variable_name IN ('max_connections','wait_timeout','max_allowed_packet','version')`,
    )
    const S = Object.fromEntries(status.map(r => [r.Variable_name, r.Value]))
    const V = Object.fromEntries(vars.map(r => [r.Variable_name, r.Value]))

    ok(`version ${V.version}, uptime ${(Number(S.Uptime) / 3600).toFixed(1)} h`)
    const used = Number(S.Threads_connected)
    const limit = Number(V.max_connections)
    const pct = limit ? (used / limit) * 100 : 0
    const line = `connections ${used}/${limit} (${pct.toFixed(0)}%), running ${S.Threads_running}, peak ${S.Max_used_connections}`
    if (pct > 80) fail(`${line} — connection pool of the SERVER is nearly exhausted`)
    else if (pct > 50) warn(line)
    else ok(line)
    // Threads_running is the sharper signal: connected-but-idle is harmless,
    // simultaneously *executing* threads compete for the same CPU and IO.
    const running = Number(S.Threads_running)
    if (running > 50) {
      saturated = true
      fail(`Threads_running=${running} — the server is thrashing; any new query starves regardless of its own cost`)
    }
    // A handful of aborted connects is normal (port scans, monitoring); a flood
    // of them is the signature of clients bouncing off a saturated server.
    if (Number(S.Aborted_connects) > 20) {
      warn(`Aborted_connects=${S.Aborted_connects} — clients repeatedly fail to complete the handshake`)
    }

    // PROCESS privilege may be missing — then we only see our own threads.
    const [procs] = await conn.query('SHOW FULL PROCESSLIST')
    const active = procs.filter(p => p.Command !== 'Sleep')
    const longest = active.sort((a, b) => Number(b.Time) - Number(a.Time))[0]
    ok(`processlist: ${procs.length} threads visible, ${active.length} active`)
    if (longest && Number(longest.Time) > 5) {
      fail(`longest running query ${longest.Time}s (${longest.State || 'no state'}): ${String(longest.Info || '').replace(/\s+/g, ' ').slice(0, 160)}`)
    }

    // Group the active queries by shape, so a pile-up points at its source
    // (which application/endpoint) instead of just showing one sample.
    if (active.length > 5) {
      const shape = q => String(q || '(no sql)')
        .replace(/\s+/g, ' ')
        .replace(/'[^']*'/g, "'?'")
        .replace(/\b\d+\b/g, '?')
        .trim()
        .slice(0, 90)
      const groups = new Map()
      for (const p of active) {
        const k = shape(p.Info)
        const g = groups.get(k) || { count: 0, maxTime: 0, states: new Set() }
        g.count++
        g.maxTime = Math.max(g.maxTime, Number(p.Time))
        g.states.add(p.State || '-')
        groups.set(k, g)
      }
      console.log('    top query shapes among active threads:')
      for (const [k, g] of [...groups].sort((a, b) => b[1].count - a[1].count).slice(0, 8)) {
        console.log(`      ${String(g.count).padStart(4)}× (max ${g.maxTime}s, ${[...g.states].join('/')}) ${k}`)
      }
    }
  } catch (err) {
    warn(`could not read server state (missing PROCESS/SELECT privilege?): ${err.message}`)
  }

  step(6, 'Real catalog queries (same SQL as /api/products)')
  for (const [name, sql] of [['categories', Q_CATEGORIES], ['products', Q_PRODUCTS]]) {
    const s = process.hrtime.bigint()
    try {
      const [rows] = await withTimeout(conn.query(sql), STEP_TIMEOUT, `${name} query`)
      const took = ms(s)
      const line = `${name}: ${rows.length} rows in ${fmt(took)}`
      if (took > 3000) fail(`${line} — this alone can blow the HTTP timeout`)
      else if (took > 500) warn(line)
      else ok(line)
    } catch (err) {
      catalogFailed = true
      fail(`${name} query failed after ${fmt(ms(s))}: ${err.code || ''} ${err.message}`)
      // Giving up on the client does NOT stop the query on the server — it would
      // keep burning IO on an already struggling box. Kill it explicitly from a
      // second connection (KILL QUERY on one's own thread needs no privilege).
      await killOwnQuery(conn.threadId, `${name} query`)
    }
  }

  await conn.end().catch(() => {})
}

// ---------------------------------------------------------- 7) pool under load

if (handshakeOk && SKIP_LOAD) {
  step(7, 'Pool under load — SKIPPED (--skip-load)')
} else if (handshakeOk && catalogFailed && !FORCE_LOAD) {
  step(7, 'Pool under load — SKIPPED (catalog query already failed)')
  console.log(`    firing ${CONCURRENCY} more heavy queries would only add load to the very`)
  console.log('    server under suspicion. Fix the DB first, then re-run — or force with --force-load.')
} else if (handshakeOk) {
  step(7, `Pool under load — ${CONCURRENCY} concurrent catalog loads (pool config identical to the app)`)
  const pool = mysql.createPool({
    ...CFG,
    waitForConnections: true,
    connectionLimit: 10, // same as server/utils/db.ts
  })
  const s = process.hrtime.bigint()
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, i) => {
      const qStart = process.hrtime.bigint()
      try {
        const c = await withTimeout(pool.getConnection(), STEP_TIMEOUT * 2, `acquire #${i}`)
        const acquired = ms(qStart)
        try {
          await withTimeout(c.query(Q_CATEGORIES), STEP_TIMEOUT * 2, `categories #${i}`)
          await withTimeout(c.query(Q_PRODUCTS), STEP_TIMEOUT * 2, `products #${i}`)
        } finally {
          c.release()
        }
        return { acquired, total: ms(qStart) }
      } catch (err) {
        return { error: err.message, total: ms(qStart) }
      }
    }),
  )
  await pool.end().catch(() => {})

  const failed = results.filter(r => r.error)
  const done = results.filter(r => !r.error)
  const totals = done.map(r => r.total).sort((a, b) => a - b)
  const waits = done.map(r => r.acquired).sort((a, b) => a - b)
  const p = (arr, q) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q))] : NaN)

  ok(`wall clock ${fmt(ms(s))} for ${CONCURRENCY} requests, ${done.length} ok / ${failed.length} failed`)
  if (done.length) {
    const waitLine = `pool wait: p50 ${fmt(p(waits, 0.5))}, max ${fmt(waits[waits.length - 1])}`
    if (waits[waits.length - 1] > 1000) fail(`${waitLine} — requests queue for a free connection (connectionLimit 10, no queue timeout ⇒ they hang forever under load)`)
    else ok(waitLine)
    const totalLine = `request total: p50 ${fmt(p(totals, 0.5))}, p95 ${fmt(p(totals, 0.95))}, max ${fmt(totals[totals.length - 1])}`
    if (totals[totals.length - 1] > 5000) fail(totalLine)
    else ok(totalLine)
  }
  for (const f of failed.slice(0, 3)) fail(`request failed: ${f.error}`)
}

// ------------------------------------------------------------- 8) HTTP probe

if (APP_URL) {
  step(8, `HTTP probe of the running app (${APP_URL}/api/products)`)
  for (let i = 0; i < 3; i++) {
    const s = process.hrtime.bigint()
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)
      const res = await fetch(`${APP_URL.replace(/\/$/, '')}/api/products`, { signal: ctrl.signal })
      const body = await res.text()
      clearTimeout(timer)
      const took = ms(s)
      const line = `#${i + 1}: HTTP ${res.status}, ${body.length} bytes in ${fmt(took)}`
      if (!res.ok || took > 3000) fail(line)
      else ok(line)
    } catch (err) {
      fail(`#${i + 1}: no response after ${fmt(ms(s))} — ${err.message}`)
    }
  }
}

// ---------------------------------------------------------------- verdict

const fails = findings.filter(f => f.level === 'fail')
const warns = findings.filter(f => f.level === 'warn')

console.log('\n=== VERDICT ===')
let code = 0
if (!tcpOk) {
  console.log('THEORY CONFIRMED — the database is not reachable at all (TCP layer).')
  console.log('The Nuxt SSR call in /api/products blocks until the connect timeout, /shop times out.')
  code = 1
} else if (!handshakeOk) {
  console.log('THEORY CONFIRMED (variant) — TCP is open, but the MySQL handshake with the app credentials fails.')
  console.log('See step 3 for the exact cause (credentials, database, or max_connections).')
  code = 1
} else if (fails.length) {
  console.log('THEORY REJECTED — the DB is reachable and authenticates with the app credentials.')
  if (saturated) {
    console.log('It is SATURATED, not down: connect and SELECT 1 are fast, but real queries starve')
    console.log('behind hundreds of concurrently executing threads. Look at the query shapes in step 5')
    console.log('to find which application produces the pile-up — it need not be this one.')
  }
  console.log('Findings:')
  for (const f of fails) console.log(`  ✗ ${f.msg}`)
  code = 2
} else if (warns.length) {
  console.log('THEORY REJECTED — DB reachable and functional, but with warnings:')
  for (const f of warns) console.log(`  ! ${f.msg}`)
  console.log('If /shop still times out, the cause is above the DB layer (app process, SSR, reverse proxy).')
} else {
  console.log('DB reachable, fast, and not saturated — the /shop timeout does NOT come from the database.')
  console.log('Next suspects: the Node process itself (event loop blocked / stale pool after a DB restart),')
  console.log('or the reverse proxy in front of it. Re-run with --url http://127.0.0.1:3000 to compare.')
}
console.log(`\ntotal runtime ${fmt(ms(t0))}, exit ${code}`)
process.exit(code)
