// packages/scanner/diffEngine.js
// Compares before/after slot values, decodes them based on ABI type

const { ethers } = require('ethers')

function decodeValue(rawHex, type) {
  if (!rawHex || rawHex === '0x' + '0'.repeat(64)) {
    return zeroForType(type)
  }

  try {
    if (type === 'address') {
      return '0x' + rawHex.slice(-40)
    }
    if (type === 'bool') {
      return rawHex.endsWith('1') ? 'true' : 'false'
    }
    if (type.startsWith('uint') || type.startsWith('int')) {
      const bn = ethers.BigNumber.from(rawHex)
      // Format large numbers with commas for readability
      return Number(bn.toString()).toLocaleString()
    }
    if (type.startsWith('bytes')) {
      return rawHex
    }
    // Unknown type: return shortened hex
    return rawHex.slice(0, 18) + '...'
  } catch {
    return rawHex.slice(0, 18) + '...'
  }
}

function zeroForType(type) {
  if (type === 'address') return '0x0000...0000'
  if (type === 'bool') return 'false'
  if (type.startsWith('uint') || type.startsWith('int')) return '0'
  return '0x00'
}

function isZero(rawHex) {
  return !rawHex || rawHex === '0x' + '0'.repeat(64) || rawHex === '0x0'
}

// Compare slot snapshots and return list of changed variables
function diff(layout, slotValues) {
  const changes = []

  for (const item of layout) {
    const pair = slotValues[item.slot]
    if (!pair) continue

    const { before, after } = pair
    if (before === after) continue // No change

    const decodedBefore = decodeValue(before, item.type)
    const decodedAfter = decodeValue(after, item.type)

    // Skip if both decode to the same thing (e.g. two different zero representations)
    if (decodedBefore === decodedAfter) continue

    changes.push({
      slot: item.slot,
      slotIndex: item.slotIndex,
      name: item.name,
      type: item.type,
      category: item.category,
      rawBefore: before,
      rawAfter: after,
      valueBefore: decodedBefore,
      valueAfter: decodedAfter,
      isNewAddress: item.type === 'address' && isZero(before) && !isZero(after),
      wasZeroed: item.type === 'address' && !isZero(before) && isZero(after)
    })
  }

  return changes
}

module.exports = { diff, decodeValue }
