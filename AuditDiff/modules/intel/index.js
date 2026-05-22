// packages/intel/index.js
// Address intelligence microservice
// Runs on port 3002 and serves GET /intel/:address

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const http = require('http')
const https = require('https')
const { getHistory } = require('./history')
const { isKnownExploiter } = require('./exploitDB')
const { getLabel } = require('./labels')
const { getCache, setCache } = require('./cache')

const PORT = process.env.PORT || 3002
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    }).on('error', reject)
  })
}

async function getIntel(address) {
  const addr = address.toLowerCase()
  const cached = getCache(addr)
  if (cached) return cached

  const [history, exploiter, label] = await Promise.all([
    getHistory(addr).catch(() => ({ txCount: null, firstSeen: null })),
    isKnownExploiter(addr).catch(() => false),
    getLabel(addr).catch(() => null)
  ])

  const result = {
    address: addr,
    txCount: history.txCount,
    firstSeen: history.firstSeen,
    isKnownExploiter: exploiter,
    isKnownLabeled: !!label,
    label: label || null,
    fetchedAt: new Date().toISOString()
  }

  setCache(addr, result, CACHE_TTL_MS)
  return result
}

// Simple HTTP server (no framework needed)
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.url === '/health') {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true }))
    return
  }

  const match = req.url.match(/^\/intel\/(0x[a-fA-F0-9]{40})$/)
  if (!match) {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const address = match[1]
  try {
    const intel = await getIntel(address)
    res.writeHead(200)
    res.end(JSON.stringify(intel))
  } catch (err) {
    console.error('[intel] Error for', address, err.message)
    res.writeHead(500)
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log(`[intel] Address intelligence service running on port ${PORT}`)
})
