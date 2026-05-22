// packages/rules/rules/ownership.js
// Rules for ownership and admin role changes

const OWNERSHIP_NAMES = ['owner', 'admin', 'governor', 'controller', 'guardian', 'timelock', 'multisig', 'proxyadmin', 'upgradeadmin', 'implementation']

function isOwnershipVar(name) {
  const n = name.toLowerCase()
  return OWNERSHIP_NAMES.some(k => n.includes(k))
}

const ownershipRules = [
  {
    id: 'OWNER_TRANSFER',
    label: 'Ownership transferred',
    description: (change) =>
      `The ${change.name} variable changed from ${change.valueBefore} to ${change.valueAfter}. ` +
      `This means the contract is now controlled by a different address.`,
    severity: 'critical',
    match: (change) =>
      isOwnershipVar(change.name) &&
      change.type === 'address' &&
      !change.isNewAddress && // was set before, changed to new value
      !change.wasZeroed
  },
  {
    id: 'OWNER_RENOUNCED',
    label: 'Ownership renounced',
    description: (change) =>
      `The ${change.name} was set to the zero address. Ownership has been permanently renounced. ` +
      `This may be intentional but disables all admin functions.`,
    severity: 'high',
    match: (change) =>
      isOwnershipVar(change.name) &&
      change.wasZeroed
  },
  {
    id: 'IMPL_UPGRADED',
    label: 'Proxy implementation upgraded',
    description: (change) =>
      `The proxy contract's implementation address changed from ${change.valueBefore} to ${change.valueAfter}. ` +
      `All contract logic now runs from the new implementation. This could introduce malicious code.`,
    severity: 'critical',
    match: (change) =>
      (change.name.toLowerCase().includes('impl') || change.name.toLowerCase().includes('logic')) &&
      change.type === 'address'
  }
]

module.exports = { ownershipRules }
