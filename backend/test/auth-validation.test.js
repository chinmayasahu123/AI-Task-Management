import assert from 'node:assert/strict'
import test from 'node:test'
import { validateLogin, validateRegistration } from '../src/auth/validation.js'
import { hashPassword, verifyPassword } from '../src/auth/passwords.js'

test('normalizes account name and email during registration', () => {
  assert.deepEqual(validateRegistration({
    name: '  Taylor Morgan ',
    email: ' Taylor@Example.com ',
    password: 'strong-pass-123',
  }), {
    name: 'Taylor Morgan',
    email: 'taylor@example.com',
    password: 'strong-pass-123',
  })
})

test('rejects invalid registration names, emails, and short passwords', () => {
  assert.throws(() => validateRegistration({ name: ' ', email: 'a@example.com', password: 'password1' }), /Name is required/)
  assert.throws(() => validateRegistration({ name: 'Taylor', email: 'invalid', password: 'password1' }), /valid email/)
  assert.throws(() => validateRegistration({ name: 'Taylor', email: 'a@example.com', password: 'short' }), /8 and 128/)
})

test('normalizes email for login and requires a password', () => {
  assert.deepEqual(validateLogin({ email: ' TAYLOR@example.com ', password: 'password1' }), {
    email: 'taylor@example.com',
    password: 'password1',
  })
  assert.throws(() => validateLogin({ email: 'taylor@example.com', password: '' }), /Password is required/)
})

test('stores passwords as salted hashes and verifies them safely', async () => {
  const credentials = await hashPassword('strong-pass-123')
  assert.notEqual(credentials.hash, 'strong-pass-123')
  assert.equal(await verifyPassword('strong-pass-123', credentials.salt, credentials.hash), true)
  assert.equal(await verifyPassword('wrong-password', credentials.salt, credentials.hash), false)
})
