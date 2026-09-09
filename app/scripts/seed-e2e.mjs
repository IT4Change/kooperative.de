/**
 * Resets the database to a known state for the full-stack E2E suite.
 *
 * The production data is a 33 MB osCommerce dump with real customer records and
 * never leaves the operator's machine. This script builds an equivalent, tiny,
 * entirely synthetic shop from the two committed, data-free artifacts:
 *
 *   database/schema/oscommerce.sql   the real DDL (extracted, no rows)
 *   database/seed/reference.sql      the real lookup rows (countries, tax, status)
 *
 * Every run is a full reset, so the suite can be re-run and retried without
 * state bleeding between passes.
 *
 * Usage (from app/):  node scripts/seed-e2e.mjs
 *
 * REFUSES to run against a database that looks like production — see the guard
 * below. Configure the target through the same DB_* env as the app.
 */
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createConnection } from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const dbDir = join(appRoot, '..', 'database')

// Same .env loader as scripts/migrate.mjs — credentials cannot drift from the app's.
const envPath = join(appRoot, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const CFG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'koop',
  password: process.env.DB_PASSWORD || 'koop',
  database: process.env.DB_DATABASE || 'kooperative',
}

/** Password hashing mirrored from server/utils/auth.ts (osCommerce md5:salt). */
function hashPassword(plain) {
  const md5 = (s) => createHash('md5').update(s).digest('hex')
  const salt = md5(randomBytes(8).toString('hex')).slice(0, 2)
  return `${md5(salt + plain)}:${salt}`
}

export const E2E_CUSTOMER = {
  email: 'e2e@example.org',
  password: 'e2e-test-password',
  firstname: 'Erika',
  lastname: 'Musterfrau',
}

// ---------------------------------------------------------------- fixtures
//
// Deliberately small and hand-checked: every case the catalog converter and the
// order computation can hit, and nothing else. Prices are NET — the tax class
// turns them into the gross prices the storefront shows.
//
//   tax_class_id 2 = 19 %   tax_class_id 3 = 7 %   (see database/seed/reference.sql)

const CATEGORIES = [
  { id: 1, parent: 0, sort: 1, name: 'Lebensmittel' },
  { id: 2, parent: 1, sort: 1, name: 'Öle' },
  { id: 3, parent: 0, sort: 2, name: 'Papeterie' },
]

const PRODUCTS = [
  // Plain product, 19 % → 11.90 gross
  {
    id: 1,
    category: 1,
    name: 'Honig',
    model: 'HON-1',
    price: '10.0000',
    taxClass: 2,
    status: 1,
    description: 'Honig aus der Region',
    sizes: '500 g Glas',
    viewed: 42,
  },
  // Reduced tax rate, 7 % → 3.21 gross
  {
    id: 2,
    category: 1,
    name: 'Brot',
    model: 'BRO-1',
    price: '3.0000',
    taxClass: 3,
    status: 1,
    description: 'Frisch gebacken',
    viewed: 17,
  },
  // Size variants — grouped into one product by the catalog converter
  {
    id: 3,
    category: 2,
    name: 'Olivenöl 0,5 Liter',
    model: 'OEL-05',
    price: '8.0000',
    taxClass: 2,
    status: 1,
    image: 'olivenoel.jpg',
  },
  {
    id: 4,
    category: 2,
    name: 'Olivenöl 1 Liter',
    model: 'OEL-10',
    price: '15.0000',
    taxClass: 2,
    status: 1,
  },
  // Quantity tiers — base row plus a "10+" tier
  { id: 5, category: 3, name: 'Karte', model: 'KAR-1', price: '2.0000', taxClass: 2, status: 1 },
  {
    id: 6,
    category: 3,
    name: 'Karte 10+',
    model: 'KAR-10',
    price: '1.5000',
    taxClass: 2,
    status: 1,
  },
  // Inactive — must never surface in the shop
  {
    id: 7,
    category: 1,
    name: 'Ausgelistet',
    model: 'OLD-1',
    price: '5.0000',
    taxClass: 2,
    status: 0,
  },
]

// ---------------------------------------------------------------- plumbing

function sqlFile(...parts) {
  return readFileSync(join(dbDir, ...parts), 'utf8')
}

async function main() {
  const conn = await createConnection({ ...CFG, multipleStatements: true })

  // Guard: this script truncates everything it touches. A production database
  // has orders in it; a fresh E2E database does not. Refuse rather than wipe.
  const [tables] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [CFG.database, 'orders'],
  )
  if (tables[0].c > 0) {
    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM `orders`')
    if (rows[0].c > 50 && !process.argv.includes('--force')) {
      console.error(
        `refusing to reset ${CFG.database}: it holds ${rows[0].c} orders and looks like real data.\n` +
          'Point DB_DATABASE at a scratch database, or pass --force if you are certain.',
      )
      process.exit(1)
    }
  }

  console.log(`[seed] target: ${CFG.user}@${CFG.host}:${CFG.port}/${CFG.database}`)

  // 1) osCommerce tables: DROP + CREATE, so the state is identical every run.
  await conn.query(sqlFile('schema', 'oscommerce.sql'))
  console.log('[seed] schema applied')

  // 2) Lookup rows whose ids the application hard-codes.
  await conn.query(sqlFile('seed', 'reference.sql'))
  console.log('[seed] reference data applied')

  // 3) koop_* tables: drop and let the real migration runner rebuild them, so
  //    the E2E database goes through the same path as a deploy.
  await conn.query(
    'DROP TABLE IF EXISTS `koop_order_mail_log`, `koop_pending_order`, `koop_schema_migrations`',
  )
  await conn.end()
  execFileSync('node', [join(appRoot, 'scripts', 'migrate.mjs')], {
    stdio: 'inherit',
    cwd: appRoot,
  })

  const db = await createConnection({ ...CFG, multipleStatements: true })

  // 4) Synthetic shop content.
  for (const c of CATEGORIES) {
    await db.query(
      'INSERT INTO `categories` (`categories_id`, `parent_id`, `sort_order`, `date_added`) VALUES (?, ?, ?, NOW())',
      [c.id, c.parent, c.sort],
    )
    await db.query(
      'INSERT INTO `categories_description` (`categories_id`, `language_id`, `categories_name`) VALUES (?, 2, ?)',
      [c.id, c.name],
    )
  }

  for (const p of PRODUCTS) {
    await db.query(
      `INSERT INTO \`products\`
         (\`products_id\`, \`products_quantity\`, \`products_model\`, \`products_image\`,
          \`products_price\`, \`products_date_added\`, \`products_status\`, \`products_tax_class_id\`)
       VALUES (?, 100, ?, ?, ?, NOW(), ?, ?)`,
      [p.id, p.model, p.image ?? null, p.price, p.status, p.taxClass],
    )
    await db.query(
      `INSERT INTO \`products_description\`
         (\`products_id\`, \`language_id\`, \`products_name\`, \`products_description\`,
          \`products_viewed\`, \`products_sizes\`)
       VALUES (?, 2, ?, ?, ?, ?)`,
      [p.id, p.name, p.description ?? '', p.viewed ?? 0, p.sizes ?? null],
    )
    await db.query(
      'INSERT INTO `products_to_categories` (`products_id`, `categories_id`) VALUES (?, ?)',
      [p.id, p.category],
    )
  }
  console.log(`[seed] ${CATEGORIES.length} categories, ${PRODUCTS.length} products`)

  // 5) A customer that can log in, with a German default address (tax zone 2).
  const [cust] = await db.query(
    `INSERT INTO \`customers\`
       (\`customers_gender\`, \`customers_firstname\`, \`customers_lastname\`, \`customers_dob\`,
        \`customers_email_address\`, \`customers_default_address_id\`, \`customers_telephone\`,
        \`customers_fax\`, \`customers_password\`, \`customers_newsletter\`,
        \`payment\`, \`rechnung\`, \`versand\`)
     VALUES ('f', ?, ?, '1980-04-01 00:00:00', ?, 0, '0711 1234567', '', ?, '0', 'vorkasse', 0, 'gls_gls')`,
    [
      E2E_CUSTOMER.firstname,
      E2E_CUSTOMER.lastname,
      E2E_CUSTOMER.email,
      hashPassword(E2E_CUSTOMER.password),
    ],
  )
  const customerId = cust.insertId

  const [addr] = await db.query(
    `INSERT INTO \`address_book\`
       (\`customers_id\`, \`entry_gender\`, \`entry_company\`, \`entry_firstname\`, \`entry_lastname\`,
        \`entry_street_address\`, \`entry_suburb\`, \`entry_postcode\`, \`entry_city\`,
        \`entry_state\`, \`entry_country_id\`, \`entry_zone_id\`)
     VALUES (?, 'f', '', ?, ?, 'Im Winkel 11', '', '88422', 'Dürnau', '', 81, 0)`,
    [customerId, E2E_CUSTOMER.firstname, E2E_CUSTOMER.lastname],
  )
  await db.query(
    'UPDATE `customers` SET `customers_default_address_id` = ? WHERE `customers_id` = ?',
    [addr.insertId, customerId],
  )
  console.log(`[seed] customer ${E2E_CUSTOMER.email} (id ${customerId})`)

  await db.end()
  console.log('[seed] done')
}

await main()
