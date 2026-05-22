// packages/scanner/abiResolver.js
// Fetches verified contract ABI from Etherscan and caches it

const https = require('https')

const cache = new Map()

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON from Etherscan')) }
      })
    }).on('error', reject)
  })
}

async function getAbi(address, network = 'mainnet') {
  const key = `${network}:${address.toLowerCase()}`
  if (cache.has(key)) return cache.get(key)

  const apiKey = process.env.ETHERSCAN_API_KEY
  const baseUrl = network === 'mainnet'
    ? 'https://api.etherscan.io/api'
    : `https://api-${network}.etherscan.io/api`

  const url = `${baseUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`

  const response = await fetchJson(url)

  if (response.status !== '1') {
    // Contract may not be verified — return empty ABI
    console.warn(`[abiResolver] ABI not found for ${address}: ${response.result}`)
    return []
  }

  const abi = JSON.parse(response.result)
  cache.set(key, abi)
  return abi
}

module.exports = { getAbi }
