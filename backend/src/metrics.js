import { timingSafeEqual } from 'node:crypto'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import client from 'prom-client'
import { pool } from './db.js'

export const register = new client.Registry()
client.collectDefaultMetrics({ register, prefix: 'tracklap_' })

const requests = new client.Counter({
  name: 'tracklap_http_requests_total',
  help: 'HTTP requests completed by the Tracklap API.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})
const duration = new client.Histogram({
  name: 'tracklap_http_request_duration_seconds',
  help: 'API request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})
const inFlight = new client.Gauge({
  name: 'tracklap_http_requests_in_flight',
  help: 'HTTP requests currently being processed.',
  registers: [register],
})
new client.Gauge({
  name: 'tracklap_mysql_pool_connections',
  help: 'Current mysql2 pool connection, idle, and queued counts.',
  labelNames: ['state'],
  registers: [register],
  collect() {
    const internalPool = pool.pool
    this.set({ state: 'all' }, internalPool?._allConnections?.length ?? 0)
    this.set({ state: 'idle' }, internalPool?._freeConnections?.length ?? 0)
    this.set({ state: 'queued' }, internalPool?._connectionQueue?.length ?? 0)
  },
})
let maintenanceQueue = null
let queueMetricsConnection = null
if (process.env.REDIS_URL) {
  queueMetricsConnection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  maintenanceQueue = new Queue('tracklap-maintenance', { connection: queueMetricsConnection })
}
new client.Gauge({
  name: 'tracklap_background_jobs',
  help: 'Background maintenance queue jobs by state.',
  labelNames: ['state'],
  registers: [register],
  async collect() {
    if (!maintenanceQueue) {
      for (const state of ['waiting', 'active', 'delayed', 'failed']) this.set({ state }, 0)
      return
    }
    try {
      const counts = await maintenanceQueue.getJobCounts('wait', 'active', 'delayed', 'failed')
      this.set({ state: 'waiting' }, counts.wait ?? 0)
      this.set({ state: 'active' }, counts.active ?? 0)
      this.set({ state: 'delayed' }, counts.delayed ?? 0)
      this.set({ state: 'failed' }, counts.failed ?? 0)
    } catch {
      for (const state of ['waiting', 'active', 'delayed', 'failed']) this.set({ state }, -1)
    }
  },
})

export function metricsMiddleware(request, response, next) {
  if (request.path === '/metrics') return next()
  const startedAt = process.hrtime.bigint()
  inFlight.inc()
  response.once('finish', () => {
    inFlight.dec()
    const route = request.route?.path
      ? `${request.baseUrl}${request.route.path}`
      : request.path.startsWith('/api/') ? '/api/unmatched' : '/unmatched'
    const labels = { method: request.method, route, status_code: String(response.statusCode) }
    requests.inc(labels)
    duration.observe(labels, Number(process.hrtime.bigint() - startedAt) / 1e9)
  })
  next()
}

export async function closeMetrics() {
  if (maintenanceQueue) await maintenanceQueue.close()
  if (queueMetricsConnection && queueMetricsConnection.status !== 'end') await queueMetricsConnection.quit()
}

export async function metricsResponse(request, response) {
  const expectedToken = process.env.METRICS_TOKEN
  if (expectedToken) {
    const supplied = request.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const expected = Buffer.from(expectedToken)
    const actual = Buffer.from(supplied)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      response.status(401).end()
      return
    }
  }
  response.set('Content-Type', register.contentType)
  response.end(await register.metrics())
}
