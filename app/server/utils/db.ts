import mysql from 'mysql2/promise'

export let pool: mysql.Pool | null = null

export function useDB() {
  if (!pool) {
    const config = useRuntimeConfig()
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      // Fail fast instead of hanging: without a queue limit every request that
      // finds the pool exhausted waits forever (mysql2 has no acquire timeout),
      // which is how a slow database turns into unbounded request timeouts.
      queueLimit: 20,
      connectTimeout: 10_000,
      // Detect half-open sockets. The DB is on a different host, so a dropped
      // connection would otherwise stay "established" on both sides for hours.
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
    })

    // The server holds a table's lock for the whole statement — including the
    // time it spends writing the result to the client. If we stall while
    // reading, MySQL blocks in "Sending to client" and keeps the lock, which
    // stalls every other reader and writer of that table (MyISAM locks whole
    // tables). This makes the server give up on a stalled transfer instead.
    pool.on('connection', (conn) => {
      conn.query('SET SESSION net_write_timeout = 30', (err: unknown) => {
        if (err) console.warn('[db] could not set net_write_timeout:', err)
      })
    })
  }
  return pool
}
