import { HttpError } from './tasks/validation.js'
import { getRedis } from './redis.js'

export function createRateLimiter({
  name = 'default',
  windowMs,
  maxRequests,
  maxClients = 5000,
  now = Date.now,
  keyGenerator,
}) {
  if (!Number.isSafeInteger(windowMs) || windowMs < 1
    || !Number.isSafeInteger(maxRequests) || maxRequests < 1
    || !Number.isSafeInteger(maxClients) || maxClients < 1) {
    throw new TypeError('Rate limiter settings must be positive integers.')
  }

  const clients = new Map()
  let nextPruneAt = 0

  function consumeLocal(key, timestamp) {
    if (timestamp >= nextPruneAt) {
      for (const [clientKey, bucket] of clients) {
        if (bucket.resetAt <= timestamp) clients.delete(clientKey)
      }
      nextPruneAt = timestamp + windowMs
    }

    let bucket = clients.get(key)
    if (!bucket || bucket.resetAt <= timestamp) bucket = { count: 0, resetAt: timestamp + windowMs }
    bucket.count += 1
    clients.delete(key)
    clients.set(key, bucket)
    while (clients.size > maxClients) clients.delete(clients.keys().next().value)
    return { count: bucket.count, resetAt: bucket.resetAt }
  }

  return async function rateLimit(request, response, next) {
    const timestamp = now()
    const key = keyGenerator
      ? String(keyGenerator(request) || 'unknown')
      : request.ip || request.socket?.remoteAddress || 'unknown'

    let result
    const store = getRedis()
    if (store) {
      try {
        const [count, ttl] = await store.eval(
          "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return {count, redis.call('PTTL', KEYS[1])}",
          1,
          `tracklap:ratelimit:${name}:${key}`,
          windowMs,
        )
        result = { count: Number(count), resetAt: timestamp + Math.max(0, Number(ttl)) }
      } catch {
        result = consumeLocal(key, timestamp)
      }
    } else {
      result = consumeLocal(key, timestamp)
    }

    const remaining = Math.max(0, maxRequests - result.count)
    response.setHeader('RateLimit-Limit', String(maxRequests))
    response.setHeader('RateLimit-Remaining', String(remaining))
    response.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))

    if (result.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - timestamp) / 1000))
      response.setHeader('Retry-After', String(retryAfter))
      next(new HttpError(429, 'Too many requests. Please try again later.'))
      return
    }

    next()
  }
}

export function createOriginGuard(allowedOrigins) {
  const allowed = new Set(
    Array.from(allowedOrigins ?? []).map((origin) => String(origin).trim().replace(/\/+$/, ''))
  )
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

  return function verifyRequestOrigin(request, _response, next) {
    const rawOrigin = request.get('origin')
    const origin = rawOrigin ? String(rawOrigin).trim().replace(/\/+$/, '') : rawOrigin
    if (!safeMethods.has(request.method) && origin && !allowed.has(origin)) {
      next(new HttpError(403, 'Request origin is not allowed.'))
      return
    }
    next()
  }
}
