import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const keyLength = 64

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, keyLength)
  return { salt: salt.toString('hex'), hash: hash.toString('hex') }
}

export async function verifyPassword(password, saltHex, hashHex) {
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  if (salt.length !== 16 || expected.length !== keyLength) return false
  const actual = await scrypt(password, salt, keyLength)
  return timingSafeEqual(actual, expected)
}
