// packages/rules/rules/state.js
// Rules for pause, freeze, blacklist and other state flags

const stateRules = [
  {
    id: 'CONTRACT_PAUSED',
    label: 'Contract paused',
    description: (change) =>
      `The ${change.name} flag was set to true, pausing contract functionality. ` +
      `Users are likely unable to withdraw or trade while the contract is paused.`,
    severity: 'critical',
    match: (change) =>
      change.name.toLowerCase().match(/pause|halt|stop|frozen/) !== null &&
      change.type === 'bool' &&
      change.valueAfter === 'true'
  },
  {
    id: 'CONTRACT_UNPAUSED',
    label: 'Contract unpaused',
    description: (change) =>
      `The ${change.name} flag was cleared, resuming contract functionality after a pause.`,
    severity: 'low',
    match: (change) =>
      change.name.toLowerCase().match(/pause|halt|stop|frozen/) !== null &&
      change.type === 'bool' &&
      change.valueAfter === 'false' &&
      change.valueBefore === 'true'
  },
  {
    id: 'BLACKLIST_ENABLED',
    label: 'Blacklist/blocklist enabled',
    description: (change) =>
      `The ${change.name} flag was enabled. The contract can now block specific ` +
      `addresses from transacting. This is a centralisation risk.`,
    severity: 'medium',
    match: (change) =>
      change.name.toLowerCase().match(/blacklist|blocklist|denylist|block/) !== null &&
      change.type === 'bool' &&
      change.valueAfter === 'true'
  },
  {
    id: 'MINT_ENABLED',
    label: 'Minting enabled',
    description: (change) =>
      `${change.name} was enabled. The contract can now create new tokens, ` +
      `potentially diluting existing holders.`,
    severity: 'medium',
    match: (change) =>
      change.name.toLowerCase().includes('mintable') ||
      (change.name.toLowerCase().includes('mint') && change.type === 'bool' && change.valueAfter === 'true')
  },
  {
    id: 'EMERGENCY_MODE',
    label: 'Emergency mode activated',
    description: (change) =>
      `${change.name} was activated. Emergency modes often grant expanded admin powers ` +
      `or bypass normal access controls.`,
    severity: 'high',
    match: (change) =>
      change.name.toLowerCase().match(/emergency|crisis|shutdown/) !== null &&
      change.type === 'bool' &&
      change.valueAfter === 'true'
  }
]

module.exports = { stateRules }
