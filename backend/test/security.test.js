import assert from 'node:assert/strict'
import test from 'node:test'
import { createOriginGuard, createRateLimiter } from '../src/security.js'
import { HttpError } from '../src/tasks/validation.js'

function runMiddleware(middleware, request) {
  const headers = {}
  let nextError
  middleware(request, { setHeader: (name, value) => { headers[name] = value } }, (error) => {
    nextError = error
  })
  return { headers, nextError }
}

test('rate limiter rejects requests beyond its window limit and reports retry time', () => {
  let timestamp = 1000
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, now: () => timestamp })
  const request = { ip: '192.0.2.1' }

  assert.equal(runMiddleware(limiter, request).nextError, undefined)
  assert.equal(runMiddleware(limiter, request).nextError, undefined)
  const limited = runMiddleware(limiter, request)
  assert.ok(limited.nextError instanceof HttpError)
  assert.equal(limited.nextError.status, 429)
  assert.equal(limited.headers['Retry-After'], '60')

  timestamp += 60_000
  assert.equal(runMiddleware(limiter, request).nextError, undefined)
})

test('rate limiter keeps independent client buckets within its memory cap', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, maxClients: 2, now: () => 1000 })
  assert.equal(runMiddleware(limiter, { ip: '192.0.2.1' }).nextError, undefined)
  assert.equal(runMiddleware(limiter, { ip: '192.0.2.2' }).nextError, undefined)

  const firstClientAgain = runMiddleware(limiter, { ip: '192.0.2.1' })
  assert.ok(firstClientAgain.nextError instanceof HttpError)
  assert.ok(runMiddleware(limiter, { ip: '192.0.2.1' }).nextError instanceof HttpError)
})

test('origin guard allows safe requests and configured same-site writes', () => {
  const guard = createOriginGuard(['http://localhost:5173'])
  const invoke = (method, origin) => runMiddleware(guard, {
    method,
    get: (name) => name === 'origin' ? origin : undefined,
  }).nextError

  assert.equal(invoke('GET', 'https://untrusted.example'), undefined)
  assert.equal(invoke('POST', undefined), undefined)
  assert.equal(invoke('POST', 'http://localhost:5173'), undefined)
  assert.equal(invoke('PATCH', 'https://untrusted.example')?.status, 403)
})

test('rate limiter rejects invalid configuration', () => {
  assert.throws(() => createRateLimiter({ windowMs: 0, maxRequests: 2 }), TypeError)
})

test('rate limiter supports authenticated account keys', () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 1,
    keyGenerator: (request) => `user:${request.user.id}`,
    now: () => 1000,
  })
  const first = { ip: '192.0.2.1', user: { id: 7 } }
  const sameAccountFromAnotherIp = { ip: '192.0.2.2', user: { id: 7 } }

  assert.equal(runMiddleware(limiter, first).nextError, undefined)
  assert.equal(runMiddleware(limiter, sameAccountFromAnotherIp).nextError?.status, 429)
})
