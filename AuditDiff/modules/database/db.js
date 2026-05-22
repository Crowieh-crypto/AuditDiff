// packages/database/db.js
// pg pool setup shared across all query modules

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://auditdiff:auditdiff_pass@localhost:5432/auditdiff',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (duration > 500) {
    console.warn(`[db] Slow query (${duration}ms):`, text.slice(0, 80))
  }
  return res
}

async function getClient() {
  return pool.connect()
}

module.exports = { query, getClient, pool }
