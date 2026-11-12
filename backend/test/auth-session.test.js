import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpError } from '../src/tasks/validation.js'
import { requireAuth } from '../src/auth/sessions.js'

test('requires a signed-in user for protected endpoints', () => {
  let nextError
  requireAuth({ user: null }, {}, (error) => {
    nextError = error
  })
  assert.ok(nextError instanceof HttpError)
  assert.equal(nextError.status, 401)
})

test('allows authenticated requests through the auth guard', () => {
  let nextCalled = false
  requireAuth({ user: { id: 1, name: 'Taylor' } }, {}, (error) => {
    assert.equal(error, undefined)
    nextCalled = true
  })
  assert.equal(nextCalled, true)
})
