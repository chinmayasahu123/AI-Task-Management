import { Router } from 'express'
import { pool } from '../db.js'
import { HttpError, parseTaskId, validateTaskInput, validateTaskStatus } from './validation.js'
import { requireAuth } from '../auth/sessions.js'
import multer from 'multer'

const router = Router()
router.use(requireAuth)
const attachmentUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(_request,file,callback)=>callback(null,['application/pdf','image/jpeg','image/png','image/webp','text/plain'].includes(file.mimetype))})

async function recordTaskActivity(connection, userId, taskId, activityType) {
  await connection.execute(
    'INSERT INTO task_activity (user_id, task_id, activity_type, occurred_at) VALUES (?, ?, ?, UTC_TIMESTAMP())',
    [userId, taskId, activityType],
  )
}

async function recordEvent(userId, taskId, teamId, type, summary, connection = pool) {
  await connection.execute('INSERT INTO activity_events (actor_id,task_id,team_id,event_type,summary) VALUES (?,?,?,?,?)', [userId, taskId, teamId, type, summary])
}

const taskColumns = `
  tasks.id,
  tasks.title,
  tasks.project,
  assigned_user.name AS assignee,
  assigned_user.avatar_updated_at AS assigneeAvatarUpdatedAt,
  tasks.assignee_id AS assigneeId,
  tasks.created_by AS createdBy,
  tasks.priority,
  tasks.status,
  tasks.due_date AS dueDate,
  tasks.estimated_minutes AS estimatedMinutes,
  tasks.description,
  tasks.team_id AS teamId,
  teams.name AS teamName,
  teams.lead_id AS teamLeadId,
  team_lead.name AS teamLeadName,
  tasks.created_at AS createdAt,
  tasks.updated_at AS updatedAt
`
const visibleTask = `(
  tasks.created_by = ? OR tasks.assignee_id = ? OR EXISTS (
    SELECT 1 FROM task_members AS visible_members
    WHERE visible_members.task_id = tasks.id AND visible_members.user_id = ?
  )
)`
const taskJoins = `
  LEFT JOIN users AS assigned_user ON assigned_user.id = tasks.assignee_id
  LEFT JOIN teams ON teams.id = tasks.team_id
  LEFT JOIN users AS team_lead ON team_lead.id = teams.lead_id
`

async function addMemberProgress(tasks, userId, connection = pool) {
  if (!tasks.length) return tasks
  const taskIds = tasks.map((task) => task.id)
  for (const task of tasks) {
    task.teamMembers = []
    task.isTeamTask = task.teamId !== null
    task.estimatedMinutes = task.estimatedMinutes === null ? null : Number(task.estimatedMinutes)
    task.elapsedSeconds = 0
    task.timerRunning = false
    task.timerSnapshotAt = Date.now()
    task.assigneeAvatarUrl = task.assigneeAvatarUpdatedAt
      ? `/api/tasks/${task.id}/members/${task.assigneeId}/avatar?v=${new Date(task.assigneeAvatarUpdatedAt).getTime()}`
      : null
    task.isTeamLead = task.isTeamTask && String(task.teamLeadId) === String(userId)
    task.canManage = task.isTeamTask ? task.isTeamLead : (
      String(task.createdBy) === String(userId) || String(task.assigneeId) === String(userId)
    )
  }
  const [timeEntries] = await connection.execute(
    `SELECT elapsed_seconds AS elapsedSeconds, started_at AS startedAt,
            task_id AS taskId,
            (started_at IS NOT NULL) AS timerRunning,
            CASE WHEN started_at IS NOT NULL
              THEN elapsed_seconds + TIMESTAMPDIFF(SECOND, started_at, UTC_TIMESTAMP())
              ELSE elapsed_seconds
            END AS currentElapsedSeconds
     FROM task_time_entries
     JOIN tasks AS timed_task ON timed_task.id = task_time_entries.task_id
     WHERE task_time_entries.task_id IN (${taskIds.map(() => '?').join(', ')})
       AND (
         (timed_task.team_id IS NULL AND task_time_entries.user_id = timed_task.assignee_id)
         OR (timed_task.team_id IS NOT NULL AND task_time_entries.user_id = ?)
       )`,
    [...taskIds, userId],
  )
  const tasksById = new Map(tasks.map((task) => [String(task.id), task]))
  for (const entry of timeEntries) {
    const task = tasksById.get(String(entry.taskId))
    if (!task) continue
    task.elapsedSeconds = Number(entry.currentElapsedSeconds)
    task.timerRunning = Boolean(entry.timerRunning)
  }
  const teamTaskIds = tasks.filter((task) => task.teamId !== null).map((task) => task.id)
  if (!teamTaskIds.length) return tasks

  const placeholders = teamTaskIds.map(() => '?').join(', ')
  const [members] = await connection.execute(
    `SELECT task_members.task_id AS taskId, task_members.user_id AS id,
            users.name, users.avatar_updated_at AS avatarUpdatedAt,
            task_members.status, teams.lead_id AS leadId
     FROM task_members
     JOIN users ON users.id = task_members.user_id
     JOIN tasks ON tasks.id = task_members.task_id
     JOIN teams ON teams.id = tasks.team_id
     WHERE task_members.task_id IN (${placeholders})
     ORDER BY users.name`,
    teamTaskIds,
  )
  for (const member of members) {
    const task = tasksById.get(String(member.taskId))
    if (!task) continue
    task.teamMembers.push({
      id: member.id,
      name: member.name,
      status: member.status,
      avatarUrl: member.avatarUpdatedAt
        ? `/api/tasks/${task.id}/members/${member.id}/avatar?v=${new Date(member.avatarUpdatedAt).getTime()}`
        : null,
      isLead: String(member.id) === String(member.leadId),
    })
    if (String(member.id) === String(userId)) task.myStatus = member.status
  }
  return tasks
}

async function setTaskTimer(connection, taskId, userId, status) {
  if (status === 'in_progress') {
    await connection.execute(
      `INSERT INTO task_time_entries (task_id, user_id, started_at)
       VALUES (?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE started_at = COALESCE(started_at, UTC_TIMESTAMP())`,
      [taskId, userId],
    )
    return
  }

  const [entries] = await connection.execute(
    'SELECT elapsed_seconds AS elapsedSeconds, started_at AS startedAt FROM task_time_entries WHERE task_id = ? AND user_id = ? FOR UPDATE',
    [taskId, userId],
  )
  const entry = entries[0]
  if (entry?.startedAt) {
    await connection.execute(
      `UPDATE task_time_entries
       SET elapsed_seconds = elapsed_seconds + TIMESTAMPDIFF(SECOND, started_at, UTC_TIMESTAMP()),
           started_at = NULL
       WHERE task_id = ? AND user_id = ?`,
      [taskId, userId],
    )
  }
}

async function findTask(id, userId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${taskColumns}
     FROM tasks
     ${taskJoins}
     WHERE tasks.id = ? AND ${visibleTask}`,
    [id, userId, userId, userId],
  )
  return (await addMemberProgress(rows, userId, connection))[0]
}

async function getAssignee(assigneeId, connection = pool) {
  const [rows] = await connection.execute('SELECT id, name FROM users WHERE id = ?', [assigneeId])
  if (!rows[0]) throw new HttpError(400, 'The selected assignee does not exist.')
  return rows[0]
}

async function getTeamForLead(teamId, userId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT teams.id, teams.name, teams.lead_id AS leadId, users.name AS leadName
     FROM teams JOIN users ON users.id = teams.lead_id
     WHERE teams.id = ?`,
    [teamId],
  )
  if (!rows[0]) throw new HttpError(400, 'The selected team does not exist.')
  if (String(rows[0].leadId) !== String(userId)) {
    throw new HttpError(403, 'Only the team lead can create or manage team tasks.')
  }
  return rows[0]
}

async function replaceTaskMembers(connection, taskId, teamId) {
  await connection.execute('DELETE FROM task_members WHERE task_id = ?', [taskId])
  if (teamId === null) return
  const [members] = await connection.execute(
    'SELECT user_id FROM team_members WHERE team_id = ?',
    [teamId],
  )
  if (!members.length) throw new HttpError(400, 'The selected team has no members.')
  await connection.query(
    `INSERT INTO task_members (task_id, user_id) VALUES ${members.map(() => '(?, ?)').join(', ')}`,
    members.flatMap((member) => [taskId, member.user_id]),
  )
}

router.get('/activity', async (request, response) => {
  let rangeSql = 'occurred_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)'
  let rangeValues = [Number(request.query.days ?? 365)]
  if (request.query.year !== undefined) {
    const year = Number(request.query.year)
    const currentYear = new Date().getUTCFullYear()
    if (!Number.isSafeInteger(year) || year < 2000 || year > currentYear) {
      throw new HttpError(400, 'Activity year must be between 2000 and the current year.')
    }
    rangeSql = 'occurred_at >= ? AND occurred_at < ?'
    rangeValues = [`${year}-01-01 00:00:00`, `${year + 1}-01-01 00:00:00`]
  } else if (!Number.isSafeInteger(rangeValues[0]) || rangeValues[0] < 1 || rangeValues[0] > 366) {
    throw new HttpError(400, 'Activity range must be between 1 and 366 days.')
  }
  const [activity] = await pool.execute(
    `SELECT DATE_FORMAT(occurred_at, '%Y-%m-%d') AS date,
            SUM(activity_type = 'created') AS created,
            SUM(activity_type = 'completed') AS completed
     FROM task_activity
     WHERE user_id = ? AND ${rangeSql}
     GROUP BY DATE_FORMAT(occurred_at, '%Y-%m-%d')
     ORDER BY DATE_FORMAT(occurred_at, '%Y-%m-%d')`,
    [request.user.id, ...rangeValues],
  )
  response.json({ activity: activity.map((day) => ({
    date: day.date,
    created: Number(day.created),
    completed: Number(day.completed),
  })) })
})

router.get('/', async (request, response) => {
  const paginated = request.query.limit !== undefined || request.query.cursor !== undefined
  let limit = null
  let cursor = null
  if (paginated) {
    limit = Number(request.query.limit ?? 100)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw new HttpError(400, 'Task page size must be between 1 and 200.')
    }
    if (request.query.cursor !== undefined) {
      try {
        const decoded = JSON.parse(Buffer.from(String(request.query.cursor), 'base64url').toString('utf8'))
        const timestamp = new Date(decoded.updatedAt)
        if (!Number.isFinite(timestamp.getTime()) || !/^[1-9]\d{0,19}$/.test(String(decoded.id))) throw new Error('Invalid cursor')
        cursor = { timestamp: timestamp.toISOString().slice(0, 19).replace('T', ' '), id: String(decoded.id) }
      } catch {
        throw new HttpError(400, 'Task page cursor is invalid.')
      }
    }
  }
  const cursorSql = cursor ? 'AND (tasks.updated_at < ? OR (tasks.updated_at = ? AND tasks.id < ?))' : ''
  const values = [request.user.id, request.user.id, request.user.id]
  if (cursor) values.push(cursor.timestamp, cursor.timestamp, cursor.id)
  if (paginated) values.push(limit + 1)
  const [rows] = await pool.execute(
    `SELECT ${taskColumns}
     FROM tasks
     ${taskJoins}
     WHERE ${visibleTask}
     ${cursorSql}
     ORDER BY tasks.updated_at DESC, tasks.id DESC${paginated ? ' LIMIT ?' : ''}`,
    values,
  )
  const hasMore = paginated && rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const lastTask = pageRows.at(-1)
  const nextCursor = hasMore && lastTask
    ? Buffer.from(JSON.stringify({ updatedAt: lastTask.updatedAt, id: lastTask.id })).toString('base64url')
    : null
  response.json({
    tasks: await addMemberProgress(pageRows, request.user.id),
    ...(paginated ? { pagination: { limit, hasMore, nextCursor } } : {}),
  })
})

router.get('/:id/members/:memberId/avatar', async (request, response) => {
  const taskId = parseTaskId(request.params.id)
  const memberId = parseTaskId(request.params.memberId)
  const [rows] = await pool.execute(
    `SELECT users.avatar_data AS avatarData, users.avatar_mime_type AS avatarMimeType
     FROM tasks
     JOIN users ON users.id = ?
     ${taskJoins}
     WHERE tasks.id = ? AND ${visibleTask}
       AND (
         (tasks.team_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM task_members
           WHERE task_members.task_id = tasks.id AND task_members.user_id = users.id
         ))
         OR (tasks.team_id IS NULL AND tasks.assignee_id = users.id)
       )`,
    [memberId, taskId, request.user.id, request.user.id, request.user.id],
  )
  const avatar = rows[0]
  if (!avatar?.avatarData || !avatar.avatarMimeType) {
    throw new HttpError(404, 'Task member profile picture not found.')
  }

  response.set({
    'Cache-Control': 'private, max-age=300',
    'Content-Type': avatar.avatarMimeType,
    'X-Content-Type-Options': 'nosniff',
  })
  response.send(avatar.avatarData)
})

router.get('/:id/collaboration', async (request, response) => {
  const id = parseTaskId(request.params.id)
  const task = await findTask(id, request.user.id)
  if (!task) throw new HttpError(404, 'Task not found.')
  const [subtasks] = await pool.execute('SELECT id,title,is_completed AS completed,position FROM task_subtasks WHERE task_id=? ORDER BY position,id', [id])
  const [comments] = await pool.execute(`SELECT c.id,c.body,c.created_at AS createdAt,c.user_id AS userId,u.name AS author
    FROM task_comments c JOIN users u ON u.id=c.user_id WHERE c.task_id=? ORDER BY c.created_at DESC LIMIT 100`, [id])
  const [dependencies] = await pool.execute(`SELECT t.id,t.title,t.status FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on_task_id WHERE d.task_id=?`, [id])
  const [attachments] = await pool.execute('SELECT id,filename,mime_type AS mimeType FROM task_attachments WHERE task_id=? ORDER BY created_at DESC',[id])
  response.json({ subtasks, comments, dependencies, attachments })
})

router.post('/:id/subtasks', async (request, response) => {
  const id = parseTaskId(request.params.id)
  const task = await findTask(id, request.user.id)
  if (!task?.canManage) throw new HttpError(404, 'Task not found or you cannot manage it.')
  const title = typeof request.body?.title === 'string' ? request.body.title.trim() : ''
  if (!title || title.length > 160) throw new HttpError(400, 'Subtask title is required (160 characters maximum).')
  const [[position]] = await pool.query('SELECT COALESCE(MAX(position),0)+1 AS position FROM task_subtasks WHERE task_id=?', [id])
  const [result] = await pool.execute('INSERT INTO task_subtasks (task_id,title,position) VALUES (?,?,?)', [id,title,position.position])
  await recordEvent(request.user.id,id,task.teamId,'subtask_created',`Added subtask “${title}”`)
  response.status(201).json({ id:result.insertId,title,completed:false,position:position.position })
})

router.patch('/:id/subtasks/:subtaskId', async (request, response) => {
  const id = parseTaskId(request.params.id)
  const task = await findTask(id, request.user.id)
  if (!task?.canManage) throw new HttpError(404, 'Task not found or you cannot manage it.')
  const completed = Boolean(request.body?.completed)
  const [result] = await pool.execute('UPDATE task_subtasks SET is_completed=? WHERE id=? AND task_id=?', [completed,Number(request.params.subtaskId),id])
  if (!result.affectedRows) throw new HttpError(404,'Subtask not found.')
  response.json({ completed })
})

router.delete('/:id/subtasks/:subtaskId', async (request, response) => {
  const id=parseTaskId(request.params.id); const task=await findTask(id,request.user.id)
  if(!task?.canManage) throw new HttpError(404,'Task not found or you cannot manage it.')
  await pool.execute('DELETE FROM task_subtasks WHERE id=? AND task_id=?',[Number(request.params.subtaskId),id]); response.json({success:true})
})

router.post('/:id/comments', async (request, response) => {
  const id=parseTaskId(request.params.id); const task=await findTask(id,request.user.id)
  if(!task) throw new HttpError(404,'Task not found.')
  const body=typeof request.body?.body==='string'?request.body.body.trim():''
  if(!body||body.length>5000) throw new HttpError(400,'Comment must contain 1 to 5,000 characters.')
  const [result]=await pool.execute('INSERT INTO task_comments (task_id,user_id,body) VALUES (?,?,?)',[id,request.user.id,body])
  await recordEvent(request.user.id,id,task.teamId,'comment_added','Added a comment')
  response.status(201).json({id:result.insertId,body,author:request.user.name,createdAt:new Date().toISOString(),userId:request.user.id})
})

router.delete('/:id/comments/:commentId', async (request,response)=>{
  const id=parseTaskId(request.params.id); const task=await findTask(id,request.user.id)
  if(!task) throw new HttpError(404,'Task not found.')
  const [result]=await pool.execute('DELETE FROM task_comments WHERE id=? AND task_id=? AND (user_id=? OR ?=1)',[Number(request.params.commentId),id,request.user.id,task.isTeamLead?1:0])
  if(!result.affectedRows) throw new HttpError(404,'Comment not found or cannot be deleted.')
  response.json({success:true})
})

router.post('/:id/attachments',attachmentUpload.single('attachment'),async(request,response)=>{
  const id=parseTaskId(request.params.id);const task=await findTask(id,request.user.id)
  if(!task)throw new HttpError(404,'Task not found.')
  if(!request.file)throw new HttpError(400,'Choose a PDF, image, or text file up to 5 MB.')
  const filename=request.file.originalname.replace(/[\\/\r\n\0]/g,'_').slice(0,180)||'attachment'
  const [result]=await pool.execute('INSERT INTO task_attachments (task_id,user_id,filename,mime_type,file_data) VALUES (?,?,?,?,?)',[id,request.user.id,filename,request.file.mimetype,request.file.buffer])
  response.status(201).json({id:result.insertId,filename,mimeType:request.file.mimetype})
})

router.get('/:id/attachments',async(request,response)=>{
  const id=parseTaskId(request.params.id);if(!await findTask(id,request.user.id))throw new HttpError(404,'Task not found.')
  const [attachments]=await pool.execute('SELECT id,filename,mime_type AS mimeType,created_at AS createdAt FROM task_attachments WHERE task_id=? ORDER BY created_at DESC',[id])
  response.json({attachments})
})

router.get('/:id/attachments/:attachmentId',async(request,response)=>{
  const id=parseTaskId(request.params.id);if(!await findTask(id,request.user.id))throw new HttpError(404,'Task not found.')
  const [rows]=await pool.execute('SELECT filename,mime_type AS mimeType,file_data AS fileData FROM task_attachments WHERE id=? AND task_id=?',[Number(request.params.attachmentId),id])
  if(!rows[0])throw new HttpError(404,'Attachment not found.')
  response.set({'Content-Type':rows[0].mimeType,'Content-Disposition':`attachment; filename="${rows[0].filename.replace(/["\\\r\n]/g,'_')}"`,'X-Content-Type-Options':'nosniff'})
  response.send(rows[0].fileData)
})

router.post('/:id/dependencies', async (request,response)=>{
  const id=parseTaskId(request.params.id); const task=await findTask(id,request.user.id)
  if(!task?.canManage) throw new HttpError(404,'Task not found or you cannot manage it.')
  const prerequisiteId=parseTaskId(request.body?.dependsOnTaskId)
  if(prerequisiteId===id) throw new HttpError(400,'A task cannot depend on itself.')
  const prerequisite=await findTask(prerequisiteId,request.user.id)
  if(!prerequisite) throw new HttpError(400,'Choose a task you can access.')
  const [cycle]=await pool.execute(`WITH RECURSIVE dependency_chain AS (
    SELECT depends_on_task_id FROM task_dependencies WHERE task_id=?
    UNION ALL SELECT d.depends_on_task_id FROM task_dependencies d JOIN dependency_chain c ON d.task_id=c.depends_on_task_id
  ) SELECT 1 FROM dependency_chain WHERE depends_on_task_id=? LIMIT 1`,[prerequisiteId,id])
  if(cycle.length) throw new HttpError(400,'This dependency would create a cycle.')
  await pool.execute('INSERT IGNORE INTO task_dependencies (task_id,depends_on_task_id) VALUES (?,?)',[id,prerequisiteId])
  response.status(201).json({success:true})
})

router.delete('/:id/dependencies/:dependsOnTaskId',async(request,response)=>{
  const id=parseTaskId(request.params.id);const task=await findTask(id,request.user.id)
  if(!task?.canManage)throw new HttpError(404,'Task not found or you cannot manage it.')
  await pool.execute('DELETE FROM task_dependencies WHERE task_id=? AND depends_on_task_id=?',[id,parseTaskId(request.params.dependsOnTaskId)])
  response.json({success:true})
})

router.post('/', async (request, response) => {
  const values = validateTaskInput(request.body)
  const teamId = values.team_id ?? null
  if (teamId !== null && !values.description?.trim()) {
    throw new HttpError(400, 'Add a detailed note describing the work required for a team task.')
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const assignee = teamId === null
      ? await getAssignee(values.assignee_id, connection)
      : await getTeamForLead(teamId, request.user.id, connection)
    const taskStatus = teamId === null ? values.status : 'pending'
    const [result] = await connection.execute(
      `INSERT INTO tasks
        (title, project, assignee, assignee_id, created_by, priority, status, due_date, description, team_id, estimated_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.title,
        values.project,
        teamId === null ? assignee.name : assignee.leadName,
        teamId === null ? assignee.id : assignee.leadId,
        request.user.id,
        values.priority,
        taskStatus,
        values.due_date,
        values.description ?? '',
        teamId,
        values.estimated_minutes ?? null,
      ],
    )
    await recordTaskActivity(connection, request.user.id, result.insertId, 'created')
    await recordEvent(request.user.id, result.insertId, teamId, 'task_created', `Created task “${values.title}”`, connection)
    if (taskStatus === 'completed') await recordTaskActivity(connection, request.user.id, result.insertId, 'completed')
    if (teamId !== null) await replaceTaskMembers(connection, result.insertId, teamId)
    else if (taskStatus === 'in_progress') await setTaskTimer(connection, result.insertId, assignee.id, taskStatus)
    await connection.commit()
    response.status(201).json({ task: await findTask(result.insertId, request.user.id) })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

router.patch('/:id/progress', async (request, response) => {
  const id = parseTaskId(request.params.id)
  const status = validateTaskStatus(request.body?.status)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [members] = await connection.execute(
      'SELECT status FROM task_members WHERE task_id = ? AND user_id = ? FOR UPDATE',
      [id, request.user.id],
    )
    if (!members[0]) throw new HttpError(404, 'Team task not found for this team member.')
    await connection.execute(
      'UPDATE task_members SET status = ? WHERE task_id = ? AND user_id = ?',
      [status, id, request.user.id],
    )
    if (status === 'completed' && members[0].status !== 'completed') {
      await recordTaskActivity(connection, request.user.id, id, 'completed')
    }
    const [[teamRow]] = await connection.execute('SELECT team_id AS teamId FROM tasks WHERE id=?', [id])
    await recordEvent(request.user.id,id,teamRow.teamId,'member_progress',`Updated personal task progress to ${status.replace('_',' ')}`,connection)
    await setTaskTimer(connection, id, request.user.id, status)
    await recordEvent(request.user.id, id, null, 'task_status_changed', `Changed task status to ${status.replace('_',' ')}`, connection)
    const [progress] = await connection.execute(
      `SELECT COUNT(*) AS total,
              SUM(status = 'completed') AS completed,
              SUM(status = 'in_progress') AS inProgress
       FROM task_members WHERE task_id = ?`,
      [id],
    )
    const aggregateStatus = Number(progress[0].completed) === Number(progress[0].total)
      ? 'completed'
      : Number(progress[0].inProgress) > 0 ? 'in_progress' : 'pending'
    await connection.execute('UPDATE tasks SET status = ? WHERE id = ?', [aggregateStatus, id])
    await connection.commit()
    response.json({ task: await findTask(id, request.user.id) })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

router.patch('/:id', async (request, response) => {
  const id = parseTaskId(request.params.id)
  const existingTask = await findTask(id, request.user.id)
  if (!existingTask) throw new HttpError(404, 'Task not found.')
  if (!existingTask.canManage) throw new HttpError(403, 'You do not have permission to edit this task.')
  const values = validateTaskInput(request.body, { partial: true })
  if (existingTask.isTeamTask && 'status' in values) {
    throw new HttpError(400, 'Update your individual progress through the team task progress action.')
  }
  const teamId = 'team_id' in values ? values.team_id : existingTask.teamId
  const description = 'description' in values ? values.description : existingTask.description
  if (teamId !== null && !description?.trim()) {
    throw new HttpError(400, 'Add a detailed note describing the work required for a team task.')
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    let targetTeam = null
    if (teamId !== null) targetTeam = await getTeamForLead(teamId, request.user.id, connection)
    let targetAssignee = null
    if ('assignee_id' in values && teamId === null) {
      targetAssignee = await getAssignee(values.assignee_id, connection)
      values.assignee = targetAssignee.name
    }

    const fields = Object.keys(values).filter((field) => field !== 'team_id')
    const assignments = fields.map((field) => `${field} = ?`)
    const parameters = fields.map((field) => values[field])
    assignments.push('team_id = ?')
    parameters.push(teamId)
    if (targetTeam) {
      assignments.push('assignee = ?', 'assignee_id = ?')
      parameters.push(targetTeam.leadName, targetTeam.leadId)
    }
    if (String(teamId ?? '') !== String(existingTask.teamId ?? '')) {
      assignments.push('status = ?')
      parameters.push(teamId === null ? (values.status ?? 'pending') : 'pending')
    }
    await connection.execute(
      `UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`,
      [...parameters, id],
    )
    if ('status' in values && values.status === 'completed' && existingTask.status !== 'completed') {
      await recordTaskActivity(connection, request.user.id, id, 'completed')
    }
    await recordEvent(request.user.id,id,teamId,'task_updated',`Updated task “${existingTask.title}”`,connection)
    if (String(teamId ?? '') !== String(existingTask.teamId ?? '')) {
      await replaceTaskMembers(connection, id, teamId)
      await connection.execute('DELETE FROM task_time_entries WHERE task_id = ?', [id])
    } else if ('status' in values || targetAssignee) {
      const currentStatus = values.status ?? existingTask.status
      if (targetAssignee && String(targetAssignee.id) !== String(existingTask.assigneeId)) {
        await setTaskTimer(connection, id, existingTask.assigneeId, 'pending')
      }
      await setTaskTimer(connection, id, targetAssignee?.id ?? existingTask.assigneeId, currentStatus)
    }
    await connection.commit()
    response.json({ task: await findTask(id, request.user.id) })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

router.delete('/:id', async (request, response) => {
  const id = parseTaskId(request.params.id)
  const task = await findTask(id, request.user.id)
  if (!task) throw new HttpError(404, 'Task not found.')
  if (!task.canManage) throw new HttpError(403, 'You do not have permission to delete this task.')
  await recordEvent(request.user.id,null,task.teamId,'task_deleted',`Deleted task “${task.title}”`)
  await pool.execute('DELETE FROM tasks WHERE id = ?', [id])
  response.json({ id })
})

export default router
