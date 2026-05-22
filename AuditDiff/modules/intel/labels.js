// packages/intel/labels.js
// Gets Etherscan name tags for known addresses

const https = require('https')

// Well-known labeled addresses (Etherscan name tags, public)
const KNOWN_LABELS = {
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'Tether: USDT Token',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'Centre: USD Coin',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2: Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3: Router',
  '0x00000000219ab540356cbb839cbe05303d7705fa': 'Ethereum 2.0 Deposit Contract',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH Token',
  '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': 'Compound: Comptroller',
  '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave: Lending Pool V2',
  '0xba12222222228d8ba445958a75a0704d566bf2c8': 'Balancer: Vault',
}

async function getLabel(address) {
  const addr = address.toLowerCase()

  // Check local map first
  if (KNOWN_LABELS[addr]) return KNOWN_LABELS[addr]

  // Could query Etherscan API for name tag here — skipped to avoid rate limits
  return null
}

module.exports = { getLabel }
