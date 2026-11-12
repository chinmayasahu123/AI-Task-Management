import 'dotenv/config'
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { pool } from './src/db.js'
import { assertDatabaseMigrated } from './src/migrations.js'

if (!process.env.REDIS_URL) {
  console.error('REDIS_URL is required to run the background worker.')
  process.exit(1)
}

const redisUrl = process.env.REDIS_URL
const queueConnection = new Redis(redisUrl, { maxRetriesPerRequest: null })
const workerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null })
const queue = new Queue('tracklap-maintenance', { connection: queueConnection })
const worker = new Worker('tracklap-maintenance', async (job) => {
  if (job.name !== 'cleanup-expired-sessions') throw new Error(`Unknown maintenance job: ${job.name}`)
  const [result] = await pool.execute('DELETE FROM user_sessions WHERE expires_at <= UTC_TIMESTAMP()')
  return { removedSessions: result.affectedRows }
}, { connection: workerConnection, concurrency: 1 })

worker.on('completed', (job, result) => console.info(`Maintenance job ${job.name} completed:`, result))
worker.on('failed', (job, error) => console.error(`Maintenance job ${job?.name ?? 'unknown'} failed:`, error))
worker.on('error', (error) => console.error('Background worker error:', error))

try {
  await assertDatabaseMigrated()
  await queue.upsertJobScheduler(
    'cleanup-expired-sessions-hourly',
    { every: 60 * 60 * 1000 },
    { name: 'cleanup-expired-sessions', data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 500 } },
  )
  console.info('Tracklap maintenance worker is running.')
} catch (error) {
  console.error('Unable to schedule maintenance jobs:', error)
  await worker.close()
  await queue.close()
  await Promise.all([queueConnection.quit(), workerConnection.quit()])
  await pool.end()
  process.exitCode = 1
}

async function shutdown() {
  await worker.close()
  await queue.close()
  await Promise.all([queueConnection.quit(), workerConnection.quit()])
  await pool.end()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
