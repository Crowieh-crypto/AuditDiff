// packages/scanner/index.js
// Main scanner entry: given address + block range, returns array of state changes

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { getAbi } = require('./abiResolver')
const { buildSlotLayout } = require('./slotLayout')
const { fetchAllSlots, findChangeTx, getProvider } = require('./storageFetcher')
const { diff } = require('./diffEngine')

async function scan({ address, fromBlock, toBlock, network = 'mainnet', onProgress }) {
  const progress = onProgress || (() => {})

  progress({ stage: 'abi', pct: 5, message: 'Fetching contract ABI from Etherscan...' })
  const abi = await getAbi(address, network)

  progress({ stage: 'layout', pct: 10, message: 'Building storage slot layout...' })
  const layout = buildSlotLayout(abi)

  progress({ stage: 'fetch', pct: 15, message: `Scanning ${layout.length} storage slots across ${toBlock - fromBlock} blocks...` })
  const slotValues = await fetchAllSlots(
    address,
    layout,
    fromBlock,
    toBlock,
    (pct) => progress({ stage: 'fetch', pct: 15 + Math.round(pct * 0.6), message: 'Reading storage slots...' })
  )

  progress({ stage: 'diff', pct: 75, message: 'Computing state diff...' })
  const changes = diff(layout, slotValues)

  if (changes.length === 0) {
    progress({ stage: 'done', pct: 100, message: 'No state changes found in this block range.' })
    return { changes: [], txMap: {} }
  }

  progress({ stage: 'tx', pct: 80, message: `Finding transactions for ${changes.length} changes...` })
  const provider = getProvider()
  const txMap = {}

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    try {
      const txHash = await findChangeTx(provider, address, change.slot, fromBlock, toBlock)
      txMap[change.slot] = txHash
      change.txHash = txHash
    } catch (e) {
      console.warn(`[scanner] Could not find tx for slot ${change.slot}:`, e.message)
    }
    progress({ stage: 'tx', pct: 80 + Math.round((i / changes.length) * 15), message: 'Locating change transactions...' })
  }

  progress({ stage: 'done', pct: 100, message: `Found ${changes.length} state changes.` })
  return { changes, txMap }
}

module.exports = { scan }
