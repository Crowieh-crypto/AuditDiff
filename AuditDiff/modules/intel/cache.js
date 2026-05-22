// packages/intel/cache.js
// Simple in-memory TTL cache for address intelligence results

const store = new Map()

function getCache(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value
}

function setCache(key, value, ttlMs) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  })
}

function clearCache() {
  store.clear()
}

// Prune expired entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key)
  }
}, 1000 * 60 * 10)

module.exports = { getCache, setCache, clearCache }
