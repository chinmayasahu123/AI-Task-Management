import { createHash, randomBytes } from 'node:crypto'
import { pool } from '../db.js'
import { getRedis, getSessionRedis } from '../redis.js'
import { HttpError } from '../tasks/validation.js'

const cookieName = 'tracklap_session'
const sessionLifetimeSeconds = 60 * 60 * 24 * 7
const sessionCacheSeconds = 60

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function getCookie(request, name) {
  const cookies = request.headers.cookie?.split(';') ?? []
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split('=')
    if (key === name) return value.join('=')
  }
  return null
}

function cookieOptions(maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
}

export function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`,
  )
}

export function formatSessionUser(user) {
  if (!user) return null
  const avatarTime = user.avatar_updated_at
    ? new Date(user.avatar_updated_at).getTime()
    : null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: avatarTime ? `/api/auth/avatar?v=${avatarTime}` : null,
  }
}

async function cacheSession(tokenHash, user, ttl = sessionCacheSeconds) {
  const store = getRedis()
  if (!store || !user) return
  try {
    await store.set(`tracklap:session:${tokenHash}`, JSON.stringify(user), 'EX', ttl)
  } catch {
    // MySQL remains the source of truth when Redis is temporarily unavailable.
  }
}

export async function createSession(userId, response, account = null) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ')
  await pool.execute(
    'INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [hashToken(token), userId, expiresAt],
  )
  await cacheSession(hashToken(token), formatSessionUser(account))
  setSessionCookie(response, token)
}

export async function clearSession(request, response) {
  const token = getCookie(request, cookieName)
  if (token) {
    const tokenHash = hashToken(token)
    await pool.execute('DELETE FROM user_sessions WHERE token_hash = ?', [tokenHash])
    try {
      await getRedis()?.del(`tracklap:session:${tokenHash}`)
    } catch {
      // The short cache lifetime bounds stale sessions if Redis is unavailable.
    }
  }
  response.setHeader('Set-Cookie', cookieOptions(0))
}

export async function authenticateRequest(request, _response, next) {
  try {
    const token = getCookie(request, cookieName)
    if (token) {
      const tokenHash = hashToken(token)
      const store = getSessionRedis()
      let cachedUser = null
      if (store) {
        try {
          const cached = await store.get(`tracklap:session:${tokenHash}`)
          if (cached) cachedUser = JSON.parse(cached)
        } catch {
          // Fall through to the authoritative MySQL session lookup.
        }
      }
      if (cachedUser) {
        request.user = cachedUser
      } else {
        const [rows] = await pool.execute(
          `SELECT users.id, users.name, users.email, users.avatar_updated_at
           FROM user_sessions
           JOIN users ON users.id = user_sessions.user_id
           WHERE user_sessions.token_hash = ? AND user_sessions.expires_at > UTC_TIMESTAMP()`,
          [tokenHash],
        )
        request.user = formatSessionUser(rows[0])
        if (rows[0]) await cacheSession(tokenHash, request.user)
      }
    } else {
      request.user = null
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireAuth(request, _response, next) {
  if (!request.user) {
    next(new HttpError(401, 'Please sign in to continue.'))
    return
  }
  next()
}

export function getSessionUser(request) {
  return request.user
}
