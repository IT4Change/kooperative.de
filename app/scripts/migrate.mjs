#!/usr/bin/env node
/**
 * Idempotent DB migration runner. Applies database/migrations/*.sql in order,
 * once each, tracked in `koop_schema_migrations`. Safe to run on every deploy.
 *
 * - Uses the app's DB_* env (loads app/.env if present), same as the Nuxt app.
 * - Portable across MySQL and MariaDB: statements run individually and
 *   "already exists" errors (table/column/index) are tolerated, so a DB that
 *   was migrated out-of-band is simply marked as applied.
 *
 * Usage (from app/):  node scripts/migrate.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const migrationsDir = join(appRoot, '..', 'database', 'migrations')

// Load app/.env into process.env without overriding already-set vars.
const envPath = join(appRoot, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

// "already applied" error numbers: table exists / dup column / dup key
const TOLERATED = new Set([1050, 1060, 1061])

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
}

const dbName = process.env.DB_DATABASE || 'kooperative'
const dbHost = process.env.DB_HOST || 'localhost'
const dbUser = process.env.DB_USER || 'koop'
console.log(`[migrate] target: ${dbUser}@${dbHost}/${dbName}`)

const conn = await mysql.createConnection({
  host: dbHost,
  port: Number(process.env.DB_PORT) || 3306,
  user: dbUser,
  password: process.env.DB_PASSWORD || 'koop',
  database: dbName,
})

try {
  await conn.query(
    'CREATE TABLE IF NOT EXISTS `koop_schema_migrations` ('
    + '`filename` VARCHAR(255) NOT NULL PRIMARY KEY, `applied_at` DATETIME NOT NULL) '
    + 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  )
  const [appliedRows] = await conn.query('SELECT filename FROM `koop_schema_migrations`')
  const applied = new Set(appliedRows.map(r => r.filename))

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  let ran = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] ${file} — already applied`)
      continue
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    for (const stmt of splitStatements(sql)) {
      try {
        await conn.query(stmt)
      } catch (err) {
        if (TOLERATED.has(err.errno)) {
          console.log(`[migrate]   • object already present (${err.code}) — ok`)
        } else {
          throw new Error(`migration ${file} failed: ${err.message}`)
        }
      }
    }
    await conn.query('INSERT INTO `koop_schema_migrations` (`filename`, `applied_at`) VALUES (?, NOW())', [file])
    console.log(`[migrate] ${file} — applied`)
    ran++
  }
  console.log(`[migrate] done (${ran} new, ${files.length} total).`)
} finally {
  await conn.end()
}
