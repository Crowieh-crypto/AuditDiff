// packages/rules/rules/access.js
// Rules for role assignments and access control changes

const accessRules = [
  {
    id: 'MINTER_ASSIGNED',
    label: 'Minter role assigned to new address',
    description: (change) =>
      `A minting role (${change.name}) was assigned to ${change.valueAfter}. ` +
      `This address can now create new tokens without limit unless constrained by a cap.`,
    severity: 'high',
    match: (change) =>
      change.name.toLowerCase().includes('minter') &&
      change.type === 'address' &&
      change.isNewAddress
  },
  {
    id: 'MINTER_CHANGED',
    label: 'Minter role transferred',
    description: (change) =>
      `The minting role (${change.name}) changed from ${change.valueBefore} to ${change.valueAfter}.`,
    severity: 'medium',
    match: (change) =>
      change.name.toLowerCase().includes('minter') &&
      change.type === 'address' &&
      !change.isNewAddress &&
      !change.wasZeroed
  },
  {
    id: 'OPERATOR_ASSIGNED',
    label: 'Operator role assigned',
    description: (change) =>
      `An operator role (${change.name}) was assigned to ${change.valueAfter}. ` +
      `Operators often have elevated privileges such as managing funds or modifying state.`,
    severity: 'medium',
    match: (change) =>
      change.name.toLowerCase().match(/operator|manager|executor/) !== null &&
      change.type === 'address'
  },
  {
    id: 'TREASURY_CHANGED',
    label: 'Treasury address changed',
    description: (change) =>
      `The treasury or fee recipient (${change.name}) changed from ` +
      `${change.valueBefore} to ${change.valueAfter}. Protocol fees now flow to a new address.`,
    severity: 'high',
    match: (change) =>
      change.name.toLowerCase().match(/treasury|feeto|feecollector|recipient|vault/) !== null &&
      change.type === 'address'
  },
  {
    id: 'TRUSTED_FORWARDER_CHANGED',
    label: 'Trusted forwarder changed',
    description: (change) =>
      `${change.name} changed to ${change.valueAfter}. ` +
      `Trusted forwarders can relay meta-transactions and may bypass normal msg.sender checks.`,
    severity: 'medium',
    match: (change) =>
      change.name.toLowerCase().match(/forwarder|relayer|relay/) !== null &&
      change.type === 'address'
  }
]

module.exports = { accessRules }
