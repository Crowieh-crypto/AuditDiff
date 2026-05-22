// packages/api/jobs/scanWorker.js
// Orchestrates scanner + rules + intel + database for a full scan job

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../../.env') })

const { scan } = require(path.join(__dirname, '../../scanner/index'))
const { analyze } = require(path.join(__dirname, '../../rules/index'))
const db = require(path.join(__dirname, '../../database/queries/scans'))
const https = require('https')

function fetchIntel(address) {
  const intelUrl = process.env.INTEL_SERVICE_URL || 'http://localhost:3002'
  return new Promise((resolve) => {
    https.get(`${intelUrl.replace('https:', 'http:')}/intel/${address}`, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    }).on('error', () => resolve(null))
  })
}

// Use http not https for local service
const http = require('http')
function fetchIntelLocal(address) {
  const intelUrl = (process.env.INTEL_SERVICE_URL || 'http://localhost:3002').replace('https://', 'http://')
  return new Promise((resolve) => {
    http.get(`${intelUrl}/intel/${address}`, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    }).on('error', () => resolve(null))
  })
}

// SSE broadcaster: Map of scanId -> array of response objects
const sseClients = new Map()

function registerSSE(scanId, res) {
  if (!sseClients.has(scanId)) sseClients.set(scanId, [])
  sseClients.get(scanId).push(res)
  res.on('close', () => {
    const clients = sseClients.get(scanId) || []
    sseClients.set(scanId, clients.filter(c => c !== res))
  })
}

function broadcastProgress(scanId, data) {
  const clients = sseClients.get(scanId) || []
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const res of clients) {
    try { res.write(payload) } catch {}
  }
}

async function runScan(scanId, address, fromBlock, toBlock) {
  const onProgress = async ({ stage, pct, message }) => {
    await db.updateScanProgress(scanId, { pct, message })
    broadcastProgress(scanId, { stage, pct, message })
  }

  try {
    await onProgress({ stage: 'start', pct: 0, message: 'Scan started...' })

    // Step 1: Scan blockchain
    const { changes } = await scan({
      address,
      fromBlock,
      toBlock,
      onProgress
    })

    if (changes.length === 0) {
      await db.completeScan(scanId, 0)
      broadcastProgress(scanId, { stage: 'done', pct: 100, message: 'No state changes found.', changes: [], findings: [] })
      return
    }

    await onProgress({ stage: 'intel', pct: 85, message: 'Fetching address intelligence...' })

    // Step 2: Collect unique addresses from changes and fetch intel
    const addresses = [...new Set(
      changes
        .filter(c => c.type === 'address' && c.valueAfter && c.valueAfter.startsWith('0x'))
        .map(c => c.valueAfter.toLowerCase())
    )]

    const intelResults = {}
    for (const addr of addresses) {
      const intel = await fetchIntelLocal(addr)
      if (intel) intelResults[addr] = intel
    }

    // Step 3: Run rules engine
    await onProgress({ stage: 'rules', pct: 90, message: 'Running severity analysis...' })
    const { findings, summary } = await analyze({ changes, intelResults })

    // Step 4: Persist to database
    await onProgress({ stage: 'saving', pct: 95, message: 'Saving results...' })

    const changeIdMap = {}
    for (const change of changes) {
      const changeId = await db.insertStateChange(scanId, change)
      changeIdMap[change.slot] = changeId
    }

    for (const finding of findings) {
      const changeId = finding.change ? changeIdMap[finding.change.slot] : null
      await db.insertFinding(scanId, finding, changeId)
    }

    await db.completeScan(scanId, changes.length)

    broadcastProgress(scanId, {
      stage: 'done',
      pct: 100,
      message: `Analysis complete. Found ${findings.length} findings.`,
      summary,
      changes: changes.length,
      findings: findings.length
    })

  } catch (err) {
    console.error('[scanWorker] Scan failed:', err)
    await db.failScan(scanId, err.message)
    broadcastProgress(scanId, { stage: 'error', pct: 0, message: err.message })
  }
}

module.exports = { runScan, registerSSE }
