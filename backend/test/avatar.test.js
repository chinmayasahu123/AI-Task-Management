import assert from 'node:assert/strict'
import test from 'node:test'
import { detectAvatarMimeType, requireAvatarImage } from '../src/auth/avatar.js'

test('detects supported profile image formats from their file signatures', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00])
  const webp = Buffer.from('RIFFxxxxWEBP')

  assert.equal(detectAvatarMimeType(png), 'image/png')
  assert.equal(detectAvatarMimeType(jpeg), 'image/jpeg')
  assert.equal(detectAvatarMimeType(webp), 'image/webp')
  assert.equal(detectAvatarMimeType(Buffer.from('not an image')), null)
})

test('requires a valid supported image upload', () => {
  assert.equal(requireAvatarImage({ buffer: Buffer.from([0xff, 0xd8, 0xff]) }), 'image/jpeg')
  assert.throws(() => requireAvatarImage(undefined), /Choose a JPEG/)
  assert.throws(() => requireAvatarImage({ buffer: Buffer.from('not an image') }), /valid JPEG/)
})
