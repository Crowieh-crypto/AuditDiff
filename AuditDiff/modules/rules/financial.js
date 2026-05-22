// packages/rules/rules/financial.js
// Rules for fee, supply cap, and financial parameter changes

function parseNumber(val) {
  if (!val) return 0
  const cleaned = val.toString().replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

const financialRules = [
  {
    id: 'FEE_LARGE_INCREASE',
    label: 'Fee increased significantly',
    description: (change, meta) =>
      `${change.name} was increased from ${change.valueBefore} to ${change.valueAfter} ` +
      `(${meta.multiplier}× increase). Large fee increases can trap users who cannot exit.`,
    severity: 'high',
    match: (change, meta) => {
      if (!change.name.toLowerCase().match(/fee|bps|rate|tax|commission/)) return false
      const before = parseNumber(change.valueBefore)
      const after = parseNumber(change.valueAfter)
      if (before === 0) return false
      meta.multiplier = (after / before).toFixed(1)
      return after / before >= 2
    }
  },
  {
    id: 'FEE_CRITICAL_INCREASE',
    label: 'Fee increased to extreme level',
    description: (change, meta) =>
      `${change.name} was increased from ${change.valueBefore} to ${change.valueAfter} ` +
      `(${meta.multiplier}× increase). Fees above 10% (1000 bps) are effectively a honeypot.`,
    severity: 'critical',
    match: (change, meta) => {
      if (!change.name.toLowerCase().match(/fee|bps|rate|tax/)) return false
      const before = parseNumber(change.valueBefore)
      const after = parseNumber(change.valueAfter)
      if (before === 0) return false
      meta.multiplier = (after / before).toFixed(1)
      return after / before >= 5
    }
  },
  {
    id: 'SUPPLY_CAP_LARGE_INCREASE',
    label: 'Supply cap raised significantly',
    description: (change, meta) =>
      `${change.name} was raised from ${change.valueBefore} to ${change.valueAfter} ` +
      `(${meta.multiplier}× increase). Large supply increases can dilute token holders.`,
    severity: 'high',
    match: (change, meta) => {
      if (!change.name.toLowerCase().match(/supply|cap|limit|max/)) return false
      const before = parseNumber(change.valueBefore)
      const after = parseNumber(change.valueAfter)
      if (before === 0) return false
      meta.multiplier = (after / before).toFixed(1)
      return after / before >= 10
    }
  },
  {
    id: 'WITHDRAWAL_LIMIT_CHANGED',
    label: 'Withdrawal limit modified',
    description: (change) =>
      `${change.name} changed from ${change.valueBefore} to ${change.valueAfter}. ` +
      `Changes to withdrawal limits can prevent users from accessing their funds.`,
    severity: 'medium',
    match: (change) =>
      change.name.toLowerCase().match(/withdraw|exit|redeem|limit/) !== null
  }
]

module.exports = { financialRules }
