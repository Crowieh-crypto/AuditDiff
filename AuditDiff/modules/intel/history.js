// packages/intel/history.js
// Gets transaction count and first-seen date for an address via Etherscan

const https = require('https')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    }).on('error', reject)
  })
}

async function getHistory(address) {
  const apiKey = process.env.ETHERSCAN_API_KEY
  const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=5&sort=asc&apikey=${apiKey}`

  const data = await fetchJson(url)

  if (!data || data.status !== '1' || !data.result?.length) {
    return { txCount: 0, firstSeen: null }
  }

  const firstTx = data.result[0]
  const firstSeen = firstTx?.timeStamp
    ? new Date(parseInt(firstTx.timeStamp) * 1000).toISOString()
    : null

  // Get total count via a second call
  const countUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${apiKey}`
  const countData = await fetchJson(countUrl)
  const txCount = countData?.result?.length > 0
    ? parseInt(countData.result[0].nonce || 0) + 1
    : data.result.length

  return { txCount, firstSeen }
}

module.exports = { getHistory }
