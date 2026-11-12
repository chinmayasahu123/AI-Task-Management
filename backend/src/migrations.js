import { pool, initializeDatabase } from './db.js'

// Add new numbered migrations here. Migration scripts run once, before API instances start.
const migrations = [
  { version: 1, name: 'initial-schema-and-existing-data-upgrades', up: initializeDatabase },
  { version: 2, name: 'email-verification-and-team-invitations', up: async () => {
    const [columns] = await pool.execute("SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_verified'")
    if (!Number(columns[0].total)) await pool.query('ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE')
    await pool.query(`CREATE TABLE IF NOT EXISTS email_verification_codes (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      code_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      sent_at DATETIME NOT NULL,
      CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS team_invitations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      team_id BIGINT UNSIGNED NOT NULL,
      invited_by BIGINT UNSIGNED NOT NULL,
      email VARCHAR(254) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      accepted_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_team_invites_email (email),
      CONSTRAINT fk_team_invites_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      CONSTRAINT fk_team_invites_sender FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  } },
  { version: 3, name: 'email-first-registration-codes', up: async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS registration_email_codes (
      email VARCHAR(254) NOT NULL PRIMARY KEY,
      code_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      sent_at DATETIME NOT NULL,
      verified_at DATETIME NULL,
      ticket_hash CHAR(64) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  } },
  { version: 4, name: 'collaboration-and-productivity-features', up: async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS activity_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      actor_id BIGINT UNSIGNED NOT NULL,
      task_id BIGINT UNSIGNED NULL,
      team_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(40) NOT NULL,
      summary VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_activity_actor_date (actor_id, created_at),
      INDEX idx_activity_task_date (task_id, created_at),
      CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_activity_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_activity_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS user_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      task_id BIGINT UNSIGNED NULL,
      kind VARCHAR(40) NOT NULL,
      message VARCHAR(255) NOT NULL,
      read_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_notification_task_kind (user_id, task_id, kind),
      INDEX idx_notifications_user_date (user_id, read_at, created_at),
      CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_notification_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS projects (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_id BIGINT UNSIGNED NOT NULL,
      team_id BIGINT UNSIGNED NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT NULL,
      start_date DATE NULL,
      target_date DATE NULL,
      goal VARCHAR(500) NULL,
      archived_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_project_owner_name (owner_id, name),
      INDEX idx_project_team (team_id),
      CONSTRAINT fk_project_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_project_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS task_subtasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      task_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(160) NOT NULL,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_subtasks_task_position (task_id, position),
      CONSTRAINT fk_subtask_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS task_comments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      task_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_comments_task_date (task_id, created_at),
      CONSTRAINT fk_comment_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id BIGINT UNSIGNED NOT NULL,
      depends_on_task_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (task_id, depends_on_task_id),
      CONSTRAINT fk_dependency_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_dependency_prerequisite FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS task_attachments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      task_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      filename VARCHAR(180) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_data MEDIUMBLOB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_attachments_task (task_id),
      CONSTRAINT fk_attachment_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_attachment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_codes (
      email VARCHAR(254) NOT NULL PRIMARY KEY,
      code_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      sent_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  } },
]

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT UNSIGNED NOT NULL PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [appliedRows] = await pool.query('SELECT version FROM schema_migrations')
  const applied = new Set(appliedRows.map((row) => Number(row.version)))

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    console.info(`Applying database migration ${migration.version}: ${migration.name}`)
    await migration.up()
    await pool.execute('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [migration.version, migration.name])
  }

  const [latestRows] = await pool.query('SELECT MAX(version) AS version FROM schema_migrations')
  return Number(latestRows[0]?.version ?? 0)
}

export async function assertDatabaseMigrated() {
  try {
    const [rows] = await pool.query('SELECT MAX(version) AS version FROM schema_migrations')
    const latest = Number(rows[0]?.version ?? 0)
    const expected = migrations.at(-1).version
    if (latest < expected) throw new Error(`Database schema is at migration ${latest}; run "npm run migrate" first.`)
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      throw new Error('Database schema migrations have not been run; run "npm run migrate" first.', { cause: error })
    }
    throw error
  }
}
