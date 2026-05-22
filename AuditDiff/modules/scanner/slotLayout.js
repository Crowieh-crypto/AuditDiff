// packages/scanner/slotLayout.js
// Reconstructs Solidity storage layout from ABI
// Simple variables occupy sequential slots; mappings/arrays need keccak256

const { ethers } = require('ethers')

// Solidity types that occupy exactly one 32-byte slot
const SINGLE_SLOT_TYPES = new Set([
  'address', 'bool', 'uint8', 'uint16', 'uint32', 'uint64', 'uint128', 'uint256',
  'int8', 'int16', 'int32', 'int64', 'int128', 'int256',
  'bytes1', 'bytes2', 'bytes4', 'bytes8', 'bytes16', 'bytes32'
])

// Categorise a variable name for the rules engine
function classifyVariable(name, type) {
  const n = name.toLowerCase()
  if (n.includes('owner') || n.includes('admin')) return 'ownership'
  if (n.includes('pause') || n.includes('freeze') || n.includes('stop')) return 'state'
  if (n.includes('fee') || n.includes('rate') || n.includes('bps')) return 'financial'
  if (n.includes('minter') || n.includes('burner') || n.includes('operator') || n.includes('role')) return 'access'
  if (n.includes('supply') || n.includes('cap') || n.includes('limit')) return 'financial'
  if (n.includes('blacklist') || n.includes('whitelist') || n.includes('allow')) return 'access'
  if (n.includes('upgrade') || n.includes('impl') || n.includes('proxy')) return 'ownership'
  return 'other'
}

function buildSlotLayout(abi) {
  const layout = [] // [{ slot, name, type, category }]
  let slotIndex = 0

  const stateVars = abi.filter(item =>
    item.type === 'function' &&
    item.stateMutability === 'view' &&
    item.inputs?.length === 0 &&
    item.outputs?.length === 1
  )

  // Also process declared state variable types if ABI has them
  for (const item of stateVars) {
    const type = item.outputs[0].type
    const name = item.name

    if (SINGLE_SLOT_TYPES.has(type) || type.startsWith('uint') || type.startsWith('int') || type === 'address' || type === 'bool') {
      const slotHex = ethers.utils.hexZeroPad(ethers.BigNumber.from(slotIndex).toHexString(), 32)
      layout.push({
        slot: slotHex,
        slotIndex,
        name,
        type,
        category: classifyVariable(name, type)
      })
      slotIndex++
    }
    // mappings and dynamic arrays are skipped for now (need compiler output)
  }

  // If ABI gives us nothing useful, return a set of well-known slots
  // covering common ERC20/proxy patterns
  if (layout.length === 0) {
    return getHeuristicLayout()
  }

  return layout
}

// Fallback: scan the first 20 slots for any contract without verified ABI
function getHeuristicLayout() {
  const knownSlots = [
    { slot: slot(0), slotIndex: 0, name: 'slot_0x00', type: 'unknown', category: 'other' },
    { slot: slot(1), slotIndex: 1, name: 'slot_0x01', type: 'unknown', category: 'other' },
    { slot: slot(2), slotIndex: 2, name: 'slot_0x02', type: 'unknown', category: 'other' },
    { slot: slot(3), slotIndex: 3, name: 'slot_0x03', type: 'unknown', category: 'other' },
    { slot: slot(4), slotIndex: 4, name: 'slot_0x04', type: 'unknown', category: 'other' },
    { slot: slot(5), slotIndex: 5, name: 'slot_0x05', type: 'unknown', category: 'other' },
    { slot: slot(6), slotIndex: 6, name: 'slot_0x06', type: 'unknown', category: 'other' },
    { slot: slot(7), slotIndex: 7, name: 'slot_0x07', type: 'unknown', category: 'other' },
    { slot: slot(8), slotIndex: 8, name: 'slot_0x08', type: 'unknown', category: 'other' },
    { slot: slot(9), slotIndex: 9, name: 'slot_0x09', type: 'unknown', category: 'other' },
  ]
  // Also include common EIP-1967 proxy slots
  knownSlots.push({
    slot: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    slotIndex: 'eip1967_impl',
    name: 'implementation',
    type: 'address',
    category: 'ownership'
  })
  knownSlots.push({
    slot: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
    slotIndex: 'eip1967_admin',
    name: 'proxyAdmin',
    type: 'address',
    category: 'ownership'
  })
  return knownSlots
}

function slot(index) {
  return ethers.utils.hexZeroPad(ethers.BigNumber.from(index).toHexString(), 32)
}

module.exports = { buildSlotLayout, classifyVariable }
