// packages/database/migrate.js
// Run schema.sql on startup to create tables if they don't exist

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const fs = require('fs')
const path = require('path')
const { pool } = require('./db')

async function migrate() {
  console.log('[migrate] Running schema migration...')
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  try {
    await pool.query(sql)
    console.log('[migrate] Schema applied successfully.')
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
