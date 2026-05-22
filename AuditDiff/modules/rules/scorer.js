// packages/rules/scorer.js
// Applies address intelligence to further escalate findings

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical']

function escalate(severity) {
  const idx = SEVERITY_ORDER.indexOf(severity)
  return SEVERITY_ORDER[Math.min(idx + 1, SEVERITY_ORDER.length - 1)]
}

// Apply address intelligence: if a new address has no history or is known bad, escalate
function applyAddressIntel(findings, intelResults) {
  return findings.map(finding => {
    if (!finding.change) return finding

    const newAddress = finding.change.valueAfter
    if (!newAddress || !newAddress.startsWith('0x') || finding.change.type !== 'address') {
      return finding
    }

    const intel = intelResults[newAddress.toLowerCase()]
    if (!intel) return finding

    let notes = []
    let shouldEscalate = false

    if (intel.txCount === 0) {
      notes.push('New address with no prior on-chain history')
      shouldEscalate = true
    } else if (intel.txCount < 5) {
      notes.push(`Low-activity address (${intel.txCount} transactions)`)
      shouldEscalate = true
    }

    if (intel.isKnownExploiter) {
      notes.push('Address appears in known exploiter databases')
      shouldEscalate = true
    }

    if (intel.isKnownLabeled) {
      notes.push(`Address labeled as: ${intel.label}`)
    }

    if (intel.firstSeen) {
      const ageInDays = Math.floor((Date.now() - new Date(intel.firstSeen).getTime()) / 86400000)
      if (ageInDays < 7) {
        notes.push(`Address created ${ageInDays} days ago`)
        shouldEscalate = true
      }
    }

    return {
      ...finding,
      severity: shouldEscalate ? escalate(finding.severity) : finding.severity,
      intelNotes: notes,
      addressIntel: intel
    }
  })
}

function sortBySeverity(findings) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 }
  return [...findings].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4))
}

function summarize(findings) {
  return {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    total: findings.length
  }
}

module.exports = { applyAddressIntel, sortBySeverity, summarize }
