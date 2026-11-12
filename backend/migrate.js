import 'dotenv/config'
import { pool } from './src/db.js'
import { runMigrations } from './src/migrations.js'

try {
  const version = await runMigrations()
  console.info(`Database is at migration ${version}.`)
} catch (error) {
  console.error('Database migration failed:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
