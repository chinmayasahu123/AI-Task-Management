import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL
let hasLoggedRedisError = false
let sessionCacheTrustedAfter = Number.POSITIVE_INFINITY

export const redis = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1500,
      commandTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
    })
  : null

if (redis) {
  redis.on('error', (error) => {
    if (hasLoggedRedisError) return
    hasLoggedRedisError = true
    console.error('Redis is unavailable; using database and process-local fallbacks:', error.message)
  })
  redis.on('ready', () => {
    hasLoggedRedisError = false
    sessionCacheTrustedAfter = Date.now() + 60_000
    console.info('Redis is ready.')
  })
}

export function getRedis() {
  return redis?.status === 'ready' ? redis : null
}

export function getSessionRedis() {
  const store = getRedis()
  return store && Date.now() >= sessionCacheTrustedAfter ? store : null
}

export async function connectRedis() {
  if (!redis) return false
  try {
    if (redis.status === 'wait') await redis.connect()
    await redis.ping()
    return true
  } catch {
    return false
  }
}

export async function closeRedis() {
  if (!redis || redis.status === 'end') return
  try {
    if (redis.status === 'ready') await redis.quit()
    else redis.disconnect()
  } catch {
    redis.disconnect()
  }
}
