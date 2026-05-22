// packages/rules/comboDetector.js
// Escalates severity when multiple dangerous changes appear in the same transaction
// This is the key intelligence layer — combos are far more suspicious than individual changes

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical']

function escalate(severity) {
  const idx = SEVERITY_ORDER.indexOf(severity)
  return SEVERITY_ORDER[Math.min(idx + 1, SEVERITY_ORDER.length - 1)]
}

// Each combo rule: array of finding IDs that trigger escalation when co-present in same tx
const COMBO_RULES = [
  {
    id: 'COMBO_PAUSE_FEE',
    label: 'Contract paused and fee increased in same transaction',
    description: 'A contract pause combined with a fee increase is a common rug pull pattern. ' +
      'Users cannot exit while fees are raised.',
    ruleIds: ['CONTRACT_PAUSED', 'FEE_LARGE_INCREASE'],
    escalate: true,
    addFinding: true,
    findingSeverity: 'critical'
  },
  {
    id: 'COMBO_OWNER_MINTER',
    label: 'Ownership transfer and minter assignment in same transaction',
    description: 'New owner immediately granted minting rights in a single transaction. ' +
      'This suggests a coordinated takeover.',
    ruleIds: ['OWNER_TRANSFER', 'MINTER_ASSIGNED'],
    escalate: true,
    addFinding: true,
    findingSeverity: 'critical'
  },
  {
    id: 'COMBO_IMPL_PAUSE',
    label: 'Proxy upgraded and contract paused in same transaction',
    description: 'A proxy upgrade combined with a pause prevents users from interacting ' +
      'while new (potentially malicious) logic is loaded.',
    ruleIds: ['IMPL_UPGRADED', 'CONTRACT_PAUSED'],
    escalate: true,
    addFinding: true,
    findingSeverity: 'critical'
  },
  {
    id: 'COMBO_OWNER_SUPPLY',
    label: 'Ownership transferred and supply cap raised in same transaction',
    description: 'New owner immediately increased the token supply cap. ' +
      'This pattern precedes large minting and token dumps.',
    ruleIds: ['OWNER_TRANSFER', 'SUPPLY_CAP_LARGE_INCREASE'],
    escalate: true,
    addFinding: true,
    findingSeverity: 'critical'
  },
  {
    id: 'COMBO_TREASURY_PAUSE',
    label: 'Treasury redirected and contract paused in same transaction',
    description: 'Fees redirected to a new address while the contract is paused. ' +
      'Funds may be being drained silently.',
    ruleIds: ['TREASURY_CHANGED', 'CONTRACT_PAUSED'],
    escalate: true,
    addFinding: true,
    findingSeverity: 'critical'
  }
]

function detectCombos(findings) {
  const comboFindings = []
  const escalations = new Set()

  // Group findings by txHash
  const byTx = {}
  for (const finding of findings) {
    const tx = finding.txHash || 'unknown'
    if (!byTx[tx]) byTx[tx] = []
    byTx[tx].push(finding)
  }

  for (const [txHash, txFindings] of Object.entries(byTx)) {
    const presentRuleIds = new Set(txFindings.map(f => f.ruleId))

    for (const combo of COMBO_RULES) {
      const allPresent = combo.ruleIds.every(id => presentRuleIds.has(id))
      if (!allPresent) continue

      // Add a combo-level finding
      if (combo.addFinding) {
        comboFindings.push({
          ruleId: combo.id,
          label: combo.label,
          description: combo.description,
          severity: combo.findingSeverity,
          txHash,
          isCombo: true,
          triggeredBy: combo.ruleIds
        })
      }

      // Escalate the individual findings that triggered this combo
      if (combo.escalate) {
        for (const finding of txFindings) {
          if (combo.ruleIds.includes(finding.ruleId)) {
            escalations.add(finding.ruleId + ':' + txHash)
          }
        }
      }
    }
  }

  // Apply escalations to original findings
  const escalatedFindings = findings.map(f => {
    const key = f.ruleId + ':' + (f.txHash || 'unknown')
    if (escalations.has(key)) {
      return { ...f, severity: escalate(f.severity), escalated: true }
    }
    return f
  })

  return [...escalatedFindings, ...comboFindings]
}

module.exports = { detectCombos }
