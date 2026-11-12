import multer from 'multer'
import { HttpError } from '../tasks/validation.js'

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
}).single('avatar')

export function detectAvatarMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export function requireAvatarImage(file) {
  if (!file) throw new HttpError(400, 'Choose a JPEG, PNG, or WebP profile picture.')
  const mimeType = detectAvatarMimeType(file.buffer)
  if (!mimeType) throw new HttpError(400, 'Profile picture must be a valid JPEG, PNG, or WebP image.')
  return mimeType
}
