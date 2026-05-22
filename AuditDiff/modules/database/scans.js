// packages/database/queries/scans.js

const { query } = require('../db')

async function createScan({ address, network, fromBlock, toBlock }) {
  // Upsert contract
  const contractRes = await query(
    `INSERT INTO contracts (address, network)
     VALUES ($1, $2)
     ON CONFLICT (address, network) DO UPDATE SET address = EXCLUDED.address
     RETURNING id`,
    [address.toLowerCase(), network || 'mainnet']
  )
  const contractId = contractRes.rows[0].id

  const scanRes = await query(
    `INSERT INTO scans (contract_id, from_block, to_block, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [contractId, fromBlock, toBlock]
  )
  return { scanId: scanRes.rows[0].id, contractId }
}

async function updateScanProgress(scanId, { pct, message }) {
  await query(
    `UPDATE scans SET progress_pct = $1, progress_message = $2, status = 'running' WHERE id = $3`,
    [pct, message, scanId]
  )
}

async function completeScan(scanId, slotsScanned) {
  await query(
    `UPDATE scans SET status = 'complete', progress_pct = 100, completed_at = NOW(), slots_scanned = $1 WHERE id = $2`,
    [slotsScanned, scanId]
  )
}

async function failScan(scanId, error) {
  await query(
    `UPDATE scans SET status = 'error', error = $1 WHERE id = $2`,
    [error, scanId]
  )
}

async function insertStateChange(scanId, change) {
  const res = await query(
    `INSERT INTO state_changes
       (scan_id, slot, slot_index, variable_name, variable_type, category,
        value_before, value_after, raw_before, raw_after, tx_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      scanId,
      change.slot,
      change.slotIndex?.toString(),
      change.name,
      change.type,
      change.category,
      change.valueBefore,
      change.valueAfter,
      change.rawBefore,
      change.rawAfter,
      change.txHash || null
    ]
  )
  return res.rows[0].id
}

async function insertFinding(scanId, finding, changeId) {
  await query(
    `INSERT INTO findings
       (scan_id, state_change_id, rule_id, label, description, severity, is_combo, escalated, intel_notes, tx_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      scanId,
      changeId || null,
      finding.ruleId,
      finding.label,
      finding.description,
      finding.severity,
      finding.isCombo || false,
      finding.escalated || false,
      JSON.stringify(finding.intelNotes || []),
      finding.txHash || null
    ]
  )
}

async function getScanWithFindings(scanId) {
  const scanRes = await query(
    `SELECT s.*, c.address, c.network
     FROM scans s JOIN contracts c ON c.id = s.contract_id
     WHERE s.id = $1`,
    [scanId]
  )
  if (!scanRes.rows.length) return null
  const scan = scanRes.rows[0]

  const changesRes = await query(
    `SELECT * FROM state_changes WHERE scan_id = $1 ORDER BY created_at`,
    [scanId]
  )

  const findingsRes = await query(
    `SELECT * FROM findings WHERE scan_id = $1 ORDER BY
       CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
    [scanId]
  )

  return {
    ...scan,
    stateChanges: changesRes.rows,
    findings: findingsRes.rows
  }
}

async function listScans(limit = 20) {
  const res = await query(
    `SELECT s.id, s.from_block, s.to_block, s.status, s.created_at, s.completed_at,
            c.address, c.network,
            COUNT(f.id) FILTER (WHERE f.severity = 'critical') as critical_count,
            COUNT(f.id) FILTER (WHERE f.severity = 'high') as high_count
     FROM scans s
     JOIN contracts c ON c.id = s.contract_id
     LEFT JOIN findings f ON f.scan_id = s.id
     GROUP BY s.id, c.address, c.network
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit]
  )
  return res.rows
}

module.exports = {
  createScan, updateScanProgress, completeScan, failScan,
  insertStateChange, insertFinding, getScanWithFindings, listScans
}
