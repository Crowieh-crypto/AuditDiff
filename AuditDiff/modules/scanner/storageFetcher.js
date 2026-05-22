// packages/scanner/storageFetcher.js
// Calls eth_getStorageAt on archive node for each slot at fromBlock and toBlock

const { ethers } = require('ethers')

function getProvider() {
  const key = process.env.ALCHEMY_API_KEY
  if (!key) throw new Error('ALCHEMY_API_KEY not set in environment')
  return new ethers.providers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${key}`
  )
}

// Fetch one slot at one block
async function fetchSlot(provider, address, slot, blockNumber) {
  const blockTag = typeof blockNumber === 'number'
    ? ethers.utils.hexValue(blockNumber)
    : blockNumber
  const raw = await provider.send('eth_getStorageAt', [address, slot, blockTag])
  return raw // 32-byte hex string
}

// Fetch all slots in layout at both blocks, return map: slot -> { before, after }
async function fetchAllSlots(address, layout, fromBlock, toBlock, onProgress) {
  const provider = getProvider()
  const results = {}
  const total = layout.length * 2
  let done = 0

  // Batch calls: all "before" fetches first, then all "after"
  const beforePromises = layout.map(async (item) => {
    const val = await fetchSlot(provider, address, item.slot, fromBlock)
    done++
    if (onProgress) onProgress(Math.round((done / total) * 50)) // 0-50%
    return { slot: item.slot, value: val }
  })

  const afterPromises = layout.map(async (item) => {
    const val = await fetchSlot(provider, address, item.slot, toBlock)
    done++
    if (onProgress) onProgress(Math.round(50 + (done / total) * 50)) // 50-100%
    return { slot: item.slot, value: val }
  })

  const beforeResults = await Promise.all(beforePromises)
  const afterResults = await Promise.all(afterPromises)

  for (let i = 0; i < layout.length; i++) {
    results[layout[i].slot] = {
      before: beforeResults[i].value,
      after: afterResults[i].value
    }
  }

  return results
}

// Get the tx hash that caused a storage change, by scanning events in the block range
async function findChangeTx(provider, address, slot, fromBlock, toBlock) {
  // Binary search: find first block where slot changed
  if (toBlock - fromBlock <= 1) {
    const block = await provider.getBlock(toBlock, true)
    if (!block || !block.transactions) return null
    // Return first tx to the contract in that block
    const tx = block.transactions.find(t =>
      t.to && t.to.toLowerCase() === address.toLowerCase()
    )
    return tx ? tx.hash : null
  }

  const mid = Math.floor((fromBlock + toBlock) / 2)
  const midVal = await fetchSlot(provider, address, slot, mid)
  const fromVal = await fetchSlot(provider, address, slot, fromBlock)

  if (midVal !== fromVal) {
    return findChangeTx(provider, address, slot, fromBlock, mid)
  } else {
    return findChangeTx(provider, address, slot, mid, toBlock)
  }
}

module.exports = { fetchAllSlots, findChangeTx, getProvider }
