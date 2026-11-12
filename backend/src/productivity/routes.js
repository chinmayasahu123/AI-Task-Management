import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/sessions.js'
import { HttpError } from '../tasks/validation.js'

const router = Router()
router.use(requireAuth)
function validateProjectDate(value,label){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new HttpError(400,`${label} must be a valid YYYY-MM-DD date.`);const parsed=new Date(`${value}T00:00:00.000Z`);if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new HttpError(400,`${label} must be a valid YYYY-MM-DD date.`);return value}

router.get('/activity', async (request, response) => {
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 40))
  const [rows] = await pool.execute(`SELECT e.id, e.event_type AS type, e.summary, e.created_at AS createdAt,
    e.task_id AS taskId, e.team_id AS teamId, users.name AS actorName
    FROM activity_events e JOIN users ON users.id=e.actor_id
    WHERE e.actor_id=? OR e.team_id IN (SELECT team_id FROM team_members WHERE user_id=?)
    ORDER BY e.created_at DESC, e.id DESC LIMIT ${limit}`, [request.user.id, request.user.id])
  response.json({ activity: rows })
})

router.get('/notifications', async (request, response) => {
  await pool.execute(`INSERT IGNORE INTO user_notifications (user_id, task_id, kind, message)
    SELECT tasks.assignee_id, tasks.id, IF(tasks.due_date < CURDATE(), 'overdue', 'due-soon'),
      IF(tasks.due_date < CURDATE(), CONCAT('Overdue: ', tasks.title), CONCAT('Due tomorrow: ', tasks.title))
    FROM tasks WHERE tasks.team_id IS NULL AND tasks.assignee_id=? AND tasks.status <> 'completed'
      AND tasks.due_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)`, [request.user.id])
  await pool.execute(`INSERT IGNORE INTO user_notifications (user_id, task_id, kind, message)
    SELECT task_members.user_id, tasks.id, IF(tasks.due_date < CURDATE(), 'overdue', 'due-soon'),
      IF(tasks.due_date < CURDATE(), CONCAT('Overdue: ', tasks.title), CONCAT('Due tomorrow: ', tasks.title))
    FROM tasks JOIN task_members ON task_members.task_id=tasks.id
    WHERE tasks.team_id IS NOT NULL AND task_members.user_id=? AND task_members.status <> 'completed'
      AND tasks.due_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)`, [request.user.id])
  const [notifications] = await pool.execute(`SELECT id, task_id AS taskId, kind, message, read_at AS readAt, created_at AS createdAt
    FROM user_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50`, [request.user.id])
  response.json({ notifications, unread: notifications.filter((item) => !item.readAt).length })
})

router.patch('/notifications/:id/read', async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Notification id is invalid.')
  await pool.execute('UPDATE user_notifications SET read_at=NOW() WHERE id=? AND user_id=?', [id, request.user.id])
  response.json({ success:true })
})

router.get('/projects', async (request, response) => {
  const [projects] = await pool.execute(`SELECT p.id, p.name, p.description, p.goal, p.start_date AS startDate,
    p.target_date AS targetDate, p.team_id AS teamId, p.archived_at AS archivedAt,
    (SELECT COUNT(*) FROM tasks t WHERE t.created_by=p.owner_id AND t.project=p.name) AS taskCount
    FROM projects p WHERE p.owner_id=? OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id=?) ORDER BY p.name`, [request.user.id, request.user.id])
  response.json({ projects })
})

router.post('/projects', async (request, response) => {
  const { name, description = '', goal = '', startDate = null, targetDate = null, teamId = null } = request.body ?? {}
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new HttpError(400, 'Project name is required (100 characters maximum).')
  if (typeof description !== 'string' || description.length > 4000 || typeof goal !== 'string' || goal.length > 500) throw new HttpError(400, 'Project description or goal is too long.')
  const safeStart=validateProjectDate(startDate,'Start date');const safeTarget=validateProjectDate(targetDate,'Target date')
  if(safeStart&&safeTarget&&safeTarget<safeStart)throw new HttpError(400,'Target date must be on or after the start date.')
  if (teamId !== null) {
    const [teams] = await pool.execute('SELECT id FROM teams WHERE id=? AND lead_id=?', [Number(teamId), request.user.id])
    if (!teams.length) throw new HttpError(403, 'Only a team lead can create a team project.')
  }
  try {
    const [result] = await pool.execute('INSERT INTO projects (owner_id,team_id,name,description,goal,start_date,target_date) VALUES (?,?,?,?,?,?,?)', [request.user.id, teamId, name.trim(), description.trim(), goal.trim(), safeStart, safeTarget])
    response.status(201).json({ id:result.insertId, name:name.trim(), description, goal, startDate:safeStart, targetDate:safeTarget, teamId })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You already have a project with that name.')
    throw error
  }
})

router.patch('/projects/:id',async(request,response)=>{
  const id=Number(request.params.id);if(!Number.isSafeInteger(id)||id<1)throw new HttpError(400,'Project id is invalid.')
  const fields=['name','description','goal','startDate','targetDate'];const values=[];const sets=[]
  for(const field of fields)if(field in (request.body??{})){let value=request.body[field];if(field==='name'&&(typeof value!=='string'||!value.trim()||value.trim().length>100))throw new HttpError(400,'Project name is required (100 characters maximum).');if(field==='description'&&(typeof value!=='string'||value.length>4000))throw new HttpError(400,'Project description is too long.');if(field==='goal'&&(typeof value!=='string'||value.length>500))throw new HttpError(400,'Project goal is too long.');if(field==='startDate'||field==='targetDate')value=validateProjectDate(value,field==='startDate'?'Start date':'Target date');sets.push(`${({startDate:'start_date',targetDate:'target_date'}[field]??field)}=?`);values.push(field==='name'?value.trim():value)}
  if(!sets.length)throw new HttpError(400,'Provide a project field to update.')
  const [result]=await pool.execute(`UPDATE projects SET ${sets.join(',')} WHERE id=? AND owner_id=?`,[...values,id,request.user.id])
  if(!result.affectedRows)throw new HttpError(404,'Project not found.')
  response.json({success:true})
})

router.patch('/projects/:id/archive', async (request, response) => {
  const id = Number(request.params.id)
  const archive = Boolean(request.body?.archive)
  const [result] = await pool.execute('UPDATE projects SET archived_at=IF(?,NOW(),NULL) WHERE id=? AND owner_id=?', [archive, id, request.user.id])
  if (!result.affectedRows) throw new HttpError(404, 'Project not found.')
  response.json({ archived: archive })
})

export default router
