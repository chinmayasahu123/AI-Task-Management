import { HttpError } from '../tasks/validation.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegistration(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    throw new HttpError(400, 'Name is required.')
  }
  const name = body.name.trim()
  if (name.length > 100) throw new HttpError(400, 'Name must be 100 characters or fewer.')

  if (typeof body.email !== 'string') throw new HttpError(400, 'A valid email is required.')
  const email = body.email.trim().toLowerCase()
  if (email.length > 254 || !emailPattern.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.')
  }

  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    throw new HttpError(400, 'Password must be between 8 and 128 characters.')
  }

  return { name, email, password: body.password }
}

export function validateLogin(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }
  if (typeof body.email !== 'string' || !emailPattern.test(body.email.trim())) {
    throw new HttpError(400, 'Enter a valid email address.')
  }
  if (typeof body.password !== 'string' || !body.password) {
    throw new HttpError(400, 'Password is required.')
  }
  return { email: body.email.trim().toLowerCase(), password: body.password }
}
