import cors from 'cors'
import express from 'express'
import { pool } from './db.js'
import authRoutes from './auth/routes.js'
import { authenticateRequest } from './auth/sessions.js'
import { HttpError } from './tasks/validation.js'
import aiRoutes from './ai/routes.js'
import taskRoutes from './tasks/routes.js'
import noteRoutes from './notes/routes.js'
import teamRoutes from './teams/routes.js'
import userRoutes from './users/routes.js'
import productivityRoutes from './productivity/routes.js'
import { createOriginGuard } from './security.js'
import multer from 'multer'
import { getRedis, redis } from './redis.js'
import { metricsMiddleware, metricsResponse } from './metrics.js'

const app = express()
const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? configuredOrigins
  : [...new Set([...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])]
const trustProxyHops = process.env.TRUST_PROXY_HOPS
  ? Number(process.env.TRUST_PROXY_HOPS)
  : null
if (trustProxyHops !== null && (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0)) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.')
}

app.disable('x-powered-by')
if (trustProxyHops !== null) app.set('trust proxy', trustProxyHops)
app.use((request, response, next) => {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
  if (request.path.startsWith('/api/')) response.set('Cache-Control', 'no-store')
  next()
})
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(createOriginGuard(allowedOrigins))
app.use(express.json({ limit: '32kb' }))
app.use(metricsMiddleware)

app.get('/api/health/live', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get(['/api/health', '/api/health/ready'], async (_request, response) => {
  const redisRequired = process.env.REDIS_REQUIRED === 'true'
  const checks = { database: false, redis: !redis && !redisRequired }
  try {
    await pool.query('SELECT 1')
    checks.database = true
  } catch {
    checks.database = false
  }
  const store = getRedis()
  if (store) {
    try {
      await store.ping()
      checks.redis = true
    } catch {
      checks.redis = false
    }
  }
  const ready = checks.database && (!redisRequired || checks.redis)
  response.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable', checks })
})

app.get('/metrics', metricsResponse)

app.use(authenticateRequest)
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/notes', noteRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/users', userRoutes)
app.use('/api', productivityRoutes)

app.use((_request, _response, next) => {
  next(new HttpError(404, 'API endpoint not found.'))
})

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }
  const isDatabaseQueueFull = error.message === 'Queue limit reached.'
  const status = error instanceof HttpError
    ? error.status
    : error instanceof multer.MulterError
      ? error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
      : isDatabaseQueueFull
        ? 503
      : error.type === 'entity.parse.failed' ? 400 : 500
  const message = error instanceof multer.MulterError
    ? error.code === 'LIMIT_FILE_SIZE' ? 'Profile picture must be 2 MB or smaller.' : 'Invalid profile picture upload.'
    : isDatabaseQueueFull
      ? 'The service is temporarily busy. Please retry shortly.'
      : error.message
  if (isDatabaseQueueFull) response.set('Retry-After', '1')
  if (status >= 500) console.error('API request failed:', error)
  response.status(status).json({
    error: status === 500 ? 'The server could not complete the request.' : message,
  })
})

export default app
