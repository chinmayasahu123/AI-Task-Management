import mysql from 'mysql2/promise'

function positiveIntegerFromEnv(name, fallback) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return value
}

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE || 'task_management',
  waitForConnections: true,
  connectionLimit: positiveIntegerFromEnv('MYSQL_CONNECTION_LIMIT', 10),
  queueLimit: positiveIntegerFromEnv('MYSQL_QUEUE_LIMIT', 100),
  connectTimeout: positiveIntegerFromEnv('MYSQL_CONNECT_TIMEOUT_MS', 10000),
  maxIdle: positiveIntegerFromEnv('MYSQL_MAX_IDLE', 10),
  idleTimeout: positiveIntegerFromEnv('MYSQL_IDLE_TIMEOUT_MS', 60000),
  dateStrings: ['DATE'],
})

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS columnCount FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, column],
  )
  if (Number(rows[0].columnCount) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
  }
}

async function ensureVarcharLength(table, column, minimumLength) {
  const [rows] = await pool.execute(
    'SELECT character_maximum_length AS columnLength FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, column],
  )
  if (Number(rows[0]?.columnLength) < minimumLength) {
    await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` VARCHAR(${minimumLength}) NOT NULL`)
  }
}

async function ensureIndex(table, index, definition) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS indexCount FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    [table, index],
  )
  if (Number(rows[0].indexCount) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD ${definition}`)
  }
}

async function ensureForeignKey(table, constraint, definition) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS constraintCount FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ?',
    [table, constraint],
  )
  if (Number(rows[0].constraintCount) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraint}\` ${definition}`)
  }
}

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL,
      password_hash CHAR(128) NOT NULL,
      password_salt CHAR(32) NOT NULL,
      avatar_data MEDIUMBLOB NULL,
      avatar_mime_type VARCHAR(32) NULL,
      avatar_updated_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await ensureColumn('users', 'avatar_data', 'MEDIUMBLOB NULL')
  await ensureColumn('users', 'avatar_mime_type', 'VARCHAR(32) NULL')
  await ensureColumn('users', 'avatar_updated_at', 'DATETIME NULL')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sessions_expires_at (expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      lead_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_teams_lead_id (lead_id),
      CONSTRAINT fk_teams_lead FOREIGN KEY (lead_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (team_id, user_id),
      INDEX idx_team_members_user_id (user_id),
      CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      project VARCHAR(80) NOT NULL,
      assignee VARCHAR(100) NOT NULL,
      priority ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
      status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
      due_date DATE NOT NULL,
      description TEXT NULL,
      team_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tasks_due_date (due_date),
      INDEX idx_tasks_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS note_folders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(80) NOT NULL,
      color CHAR(7) NOT NULL DEFAULT '#6488d8',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_note_folders_user_name (user_id, name),
      INDEX idx_note_folders_user (user_id),
      CONSTRAINT fk_note_folders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      folder_id BIGINT UNSIGNED NULL,
      title VARCHAR(120) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_notes_user_updated (user_id, updated_at),
      INDEX idx_notes_folder (folder_id),
      CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await ensureColumn('notes', 'folder_id', 'BIGINT UNSIGNED NULL')
  await ensureIndex('notes', 'idx_notes_folder', 'INDEX `idx_notes_folder` (`folder_id`)')
  await ensureForeignKey(
    'notes',
    'fk_notes_folder',
    'FOREIGN KEY (`folder_id`) REFERENCES `note_folders` (`id`) ON DELETE SET NULL',
  )

  await ensureVarcharLength('tasks', 'assignee', 100)
  await ensureColumn('tasks', 'created_by', 'BIGINT UNSIGNED NULL')
  await ensureColumn('tasks', 'assignee_id', 'BIGINT UNSIGNED NULL')
  await ensureColumn('tasks', 'team_id', 'BIGINT UNSIGNED NULL')
  await ensureColumn('tasks', 'estimated_minutes', 'SMALLINT UNSIGNED NULL')
  await ensureIndex('tasks', 'idx_tasks_created_by', 'INDEX `idx_tasks_created_by` (`created_by`)')
  await ensureIndex('tasks', 'idx_tasks_assignee_id', 'INDEX `idx_tasks_assignee_id` (`assignee_id`)')
  await ensureIndex('tasks', 'idx_tasks_team_id', 'INDEX `idx_tasks_team_id` (`team_id`)')
  await ensureIndex('tasks', 'idx_tasks_updated_id', 'INDEX `idx_tasks_updated_id` (`updated_at`, `id`)')
  await ensureForeignKey(
    'tasks',
    'fk_tasks_creator',
    'FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE',
  )
  await ensureForeignKey(
    'tasks',
    'fk_tasks_assignee',
    'FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL',
  )
  await ensureForeignKey(
    'tasks',
    'fk_tasks_team',
    'FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL',
  )

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_members (
      task_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (task_id, user_id),
      INDEX idx_task_members_user_id (user_id),
      CONSTRAINT fk_task_members_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_task_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_activity (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      task_id BIGINT UNSIGNED NOT NULL,
      activity_type ENUM('created', 'completed') NOT NULL,
      occurred_at DATETIME NOT NULL,
      INDEX idx_task_activity_user_date (user_id, occurred_at),
      INDEX idx_task_activity_task (task_id),
      CONSTRAINT fk_task_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    INSERT INTO task_activity (user_id, task_id, activity_type, occurred_at)
    SELECT tasks.created_by, tasks.id, 'created', tasks.created_at
    FROM tasks
    WHERE tasks.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM task_activity
        WHERE task_activity.task_id = tasks.id
          AND task_activity.user_id = tasks.created_by
          AND task_activity.activity_type = 'created'
      )
  `)
  await pool.query(`
    INSERT INTO task_activity (user_id, task_id, activity_type, occurred_at)
    SELECT COALESCE(task_members.user_id, tasks.assignee_id, tasks.created_by), tasks.id,
           'completed', COALESCE(task_members.updated_at, tasks.updated_at)
    FROM tasks
    LEFT JOIN task_members ON task_members.task_id = tasks.id AND task_members.status = 'completed'
    WHERE tasks.status = 'completed'
      AND COALESCE(task_members.user_id, tasks.assignee_id, tasks.created_by) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM task_activity
        WHERE task_activity.task_id = tasks.id
          AND task_activity.user_id = COALESCE(task_members.user_id, tasks.assignee_id, tasks.created_by)
          AND task_activity.activity_type = 'completed'
      )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_time_entries (
      task_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      elapsed_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      started_at DATETIME NULL DEFAULT NULL,
      PRIMARY KEY (task_id, user_id),
      INDEX idx_task_time_entries_user_id (user_id),
      CONSTRAINT fk_task_time_entries_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_task_time_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

}
