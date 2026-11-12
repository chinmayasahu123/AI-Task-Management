import 'dotenv/config'
import app from './src/app.js'
import { pool } from './src/db.js'
import { assertDatabaseMigrated } from './src/migrations.js'
import { closeRedis, connectRedis } from './src/redis.js'
import { closeMetrics } from './src/metrics.js'

const port = Number(process.env.PORT || 3001)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.')
}
try {
  await assertDatabaseMigrated()
  const redisReady = await connectRedis()
  if (process.env.REDIS_REQUIRED === 'true' && !redisReady) {
    throw new Error('REDIS_REQUIRED is enabled but Redis is not available.')
  }
  const server = app.listen(port, () => {
    console.log(`Tracklap API listening on http://localhost:${port}`)
  })
  async function shutdown() {
    server.close(async () => {
      await closeMetrics()
      await closeRedis()
      await pool.end()
      process.exit(0)
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
} catch (error) {
  console.error('Unable to start the API. Check database migrations, Redis settings, and service availability.', error)
  await closeMetrics()
  await closeRedis()
  await pool.end()
  process.exitCode = 1
}
