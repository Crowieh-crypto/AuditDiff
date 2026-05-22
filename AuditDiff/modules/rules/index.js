// packages/rules/index.js
// Rules engine entry: takes state changes, returns classified findings

const { ownershipRules } = require('./rules/ownership')
const { financialRules } = require('./rules/financial')
const { stateRules } = require('./rules/state')
const { accessRules } = require('./rules/access')
const { detectCombos } = require('./comboDetector')
const { applyAddressIntel, sortBySeverity, summarize } = require('./scorer')

const ALL_RULES = [
  ...ownershipRules,
  ...financialRules,
  ...stateRules,
  ...accessRules
]

function applyRules(changes) {
  const findings = []

  for (const change of changes) {
    for (const rule of ALL_RULES) {
      const meta = {}
      try {
        if (rule.match(change, meta)) {
          findings.push({
            ruleId: rule.id,
            label: rule.label,
            description: typeof rule.description === 'function'
              ? rule.description(change, meta)
              : rule.description,
            severity: rule.severity,
            change,
            txHash: change.txHash,
            slotIndex: change.slotIndex,
            variableName: change.name,
            isCombo: false
          })
          break // one finding per change (first matching rule wins)
        }
      } catch (e) {
        console.warn(`[rules] Rule ${rule.id} threw on change ${change.name}:`, e.message)
      }
    }
  }

  return findings
}

async function analyze({ changes, intelResults = {} }) {
  // Step 1: apply per-change rules
  let findings = applyRules(changes)

  // Step 2: detect dangerous combinations
  findings = detectCombos(findings)

  // Step 3: apply address intelligence escalations
  findings = applyAddressIntel(findings, intelResults)

  // Step 4: sort by severity
  findings = sortBySeverity(findings)

  return {
    findings,
    summary: summarize(findings)
  }
}

module.exports = { analyze }
