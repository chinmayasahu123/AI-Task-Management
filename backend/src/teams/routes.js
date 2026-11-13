import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/sessions.js'
import { HttpError } from '../tasks/validation.js'
import { createHash, randomBytes } from 'node:crypto'
import { sendEmail, teamInvitationEmail } from '../email.js'

const router = Router()
router.use(requireAuth)

function parseResourceId(value, label) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, `${label} must be a positive integer.`)
  }
  return id
}

async function findTeams(userId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT teams.id, teams.name, teams.lead_id AS leadId, lead_user.name AS leadName,
            members.user_id AS memberId, member.name AS memberName,
            member.avatar_updated_at AS avatarUpdatedAt
     FROM teams
     JOIN team_members AS current_members
       ON current_members.team_id = teams.id AND current_members.user_id = ?
     JOIN users AS lead_user ON lead_user.id = teams.lead_id
     JOIN team_members AS members ON members.team_id = teams.id
     JOIN users AS member ON member.id = members.user_id
     ORDER BY teams.name, member.name`,
    [userId],
  )
  const teams = new Map()
  for (const row of rows) {
    const key = String(row.id)
    if (!teams.has(key)) {
      teams.set(key, {
        id: row.id,
        name: row.name,
        leadId: row.leadId,
        leadName: row.leadName,
        members: [],
      })
    }
    const member = {
      id: row.memberId,
      name: row.memberName,
      isLead: String(row.memberId) === String(row.leadId),
      avatarUrl: row.avatarUpdatedAt
        ? `/api/teams/${row.id}/members/${row.memberId}/avatar?v=${new Date(row.avatarUpdatedAt).getTime()}`
        : null,
    }
    teams.get(key).members.push(member)
  }
  return [...teams.values()]
}

router.get('/', async (request, response) => {
  response.json({ teams: await findTeams(request.user.id) })
})

router.post('/:teamId/invitations', async (request, response) => {
  const teamId = parseResourceId(request.params.teamId, 'Team id')
  const emails = [...new Set((Array.isArray(request.body?.emails) ? request.body.emails : []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))]
  if (!emails.length || emails.length > 25 || emails.some((email) => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new HttpError(400, 'Enter between 1 and 25 valid email addresses.')
  const [teams] = await pool.execute('SELECT name FROM teams WHERE id = ? AND lead_id = ?', [teamId, request.user.id])
  if (!teams.length) throw new HttpError(404, 'Team not found or you are not the team lead.')
  for (const email of emails) {
    const [members] = await pool.execute('SELECT team_members.user_id FROM team_members JOIN users ON users.id=team_members.user_id WHERE team_members.team_id=? AND users.email=?', [teamId, email])
    if (members.length) continue
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await pool.execute(`INSERT INTO team_invitations (team_id, invited_by, email, token_hash, expires_at)
      VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))`, [teamId, request.user.id, email, tokenHash])
    const url = `${process.env.APP_ORIGIN || 'http://localhost:5173'}?teamInvite=${token}`
    await sendEmail({ to:email, subject:`Invitation to join ${teams[0].name} on Tracklap`, ...teamInvitationEmail(teams[0].name, url) })
  }
  response.status(202).json({ message:`Invitation email sent to ${emails.length} address${emails.length===1?'':'es'}.` })
})

router.get('/:teamId/invitations', async (request,response)=>{
  const teamId=parseResourceId(request.params.teamId,'Team id')
  const [teams]=await pool.execute('SELECT id FROM teams WHERE id=? AND lead_id=?',[teamId,request.user.id])
  if(!teams.length) throw new HttpError(404,'Team not found or you are not the team lead.')
  const [invitations]=await pool.execute(`SELECT id,email,expires_at AS expiresAt,created_at AS createdAt FROM team_invitations
    WHERE team_id=? AND accepted_at IS NULL AND expires_at>NOW() ORDER BY created_at DESC`,[teamId])
  response.json({invitations})
})

router.delete('/:teamId/invitations/:invitationId', async (request,response)=>{
  const teamId=parseResourceId(request.params.teamId,'Team id');const invitationId=parseResourceId(request.params.invitationId,'Invitation id')
  const [result]=await pool.execute(`DELETE invitations FROM team_invitations invitations JOIN teams ON teams.id=invitations.team_id
    WHERE invitations.id=? AND invitations.team_id=? AND teams.lead_id=? AND invitations.accepted_at IS NULL`,[invitationId,teamId,request.user.id])
  if(!result.affectedRows) throw new HttpError(404,'Pending invitation not found.')
  response.json({success:true})
})

router.post('/invitations/accept', async (request, response) => {
  const token = typeof request.body?.token === 'string' ? request.body.token : ''
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'Invitation link is invalid.')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const [rows] = await pool.execute(`SELECT team_invitations.id, team_invitations.team_id AS teamId, team_invitations.email, team_invitations.expires_at
    FROM team_invitations JOIN users ON users.id=? AND users.email=team_invitations.email AND users.email_verified=TRUE
    WHERE team_invitations.token_hash=? AND team_invitations.accepted_at IS NULL`, [request.user.id, tokenHash])
  const invite = rows[0]
  if (!invite || new Date(invite.expires_at).getTime() < Date.now()) throw new HttpError(400, 'Invitation is invalid, expired, or belongs to another email address.')
  await pool.execute('INSERT IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)', [invite.teamId, request.user.id])
  await pool.execute('UPDATE team_invitations SET accepted_at=UTC_TIMESTAMP() WHERE id=?', [invite.id])
  response.json({ message:'You joined the team.' })
})

router.get('/:teamId/members/:memberId/avatar', async (request, response) => {
  const teamId = parseResourceId(request.params.teamId, 'Team id')
  const memberId = parseResourceId(request.params.memberId, 'Member id')
  const [rows] = await pool.execute(
    `SELECT member.avatar_data AS avatarData, member.avatar_mime_type AS avatarMimeType
     FROM team_members AS current_member
     JOIN team_members AS target_member ON target_member.team_id = current_member.team_id
     JOIN users AS member ON member.id = target_member.user_id
     WHERE current_member.team_id = ? AND current_member.user_id = ?
       AND target_member.user_id = ?`,
    [teamId, request.user.id, memberId],
  )
  const avatar = rows[0]
  if (!avatar?.avatarData || !avatar.avatarMimeType) {
    throw new HttpError(404, 'Team member profile picture not found.')
  }

  response.set({
    'Cache-Control': 'private, max-age=300',
    'Content-Type': avatar.avatarMimeType,
    'X-Content-Type-Options': 'nosniff',
  })
  response.send(avatar.avatarData)
})

router.delete('/:teamId/members/:memberId', async (request, response) => {
  const teamId = parseResourceId(request.params.teamId, 'Team id')
  const memberId = parseResourceId(request.params.memberId, 'Member id')
  if (String(memberId) === String(request.user.id)) throw new HttpError(400, 'The team lead cannot remove themselves. Transfer or delete the team instead.')
  const [teams] = await pool.execute('SELECT id FROM teams WHERE id = ? AND lead_id = ?', [teamId, request.user.id])
  if (!teams.length) throw new HttpError(404, 'Team not found or you are not the team lead.')
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [removed] = await connection.execute('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, memberId])
    if (!removed.affectedRows) throw new HttpError(404, 'That user is not a member of this team.')
    await connection.execute(`DELETE task_members FROM task_members
      JOIN tasks ON tasks.id = task_members.task_id
      WHERE tasks.team_id = ? AND task_members.user_id = ?`, [teamId, memberId])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  response.json({ teamId, memberId, removed: true })
})

router.post('/', async (request, response) => {
  const { name, memberIds } = request.body ?? {}
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    throw new HttpError(400, 'Team name is required and must be 100 characters or fewer.')
  }
  if (!Array.isArray(memberIds) || memberIds.length > 50) {
    throw new HttpError(400, 'Choose no more than 50 registered team members.')
  }
  const ids = memberIds.map(Number)
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)
    || new Set(ids).size !== ids.length
    || ids.some((id) => String(id) === String(request.user.id))) {
    throw new HttpError(400, 'Team members must be distinct registered users other than the team lead.')
  }
  const [users] = ids.length ? await pool.execute(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(', ')})`, ids) : [[]]
  if (users.length !== ids.length) {
    throw new HttpError(400, 'One or more selected team members do not exist.')
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute(
      'INSERT INTO teams (name, lead_id) VALUES (?, ?)',
      [name.trim(), request.user.id],
    )
    const teamId = result.insertId
    const allMemberIds = [request.user.id, ...ids]
    await connection.query(
      `INSERT INTO team_members (team_id, user_id) VALUES ${allMemberIds.map(() => '(?, ?)').join(', ')}`,
      allMemberIds.flatMap((id) => [teamId, id]),
    )
    await connection.commit()
    const teams = await findTeams(request.user.id)
    response.status(201).json({ team: teams.find((team) => String(team.id) === String(teamId)) })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

router.post('/:teamId/members', async (request, response) => {
  const teamId = parseResourceId(request.params.teamId, 'Team id')
  const rawMemberIds = Array.isArray(request.body?.memberIds)
    ? request.body.memberIds
    : request.body?.memberId !== undefined
      ? [request.body.memberId]
      : []
  if (!rawMemberIds.length || rawMemberIds.length > 50) {
    throw new HttpError(400, 'Select at least 1 and no more than 50 registered members to add.')
  }
  const ids = rawMemberIds.map(Number)
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)
    || new Set(ids).size !== ids.length
    || ids.some((id) => String(id) === String(request.user.id))) {
    throw new HttpError(400, 'Team members must be distinct registered users other than the team lead.')
  }
  const [teams] = await pool.execute('SELECT id, name FROM teams WHERE id = ? AND lead_id = ?', [teamId, request.user.id])
  if (!teams.length) throw new HttpError(404, 'Team not found or you are not the team lead.')

  const [users] = await pool.execute(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(', ')})`, ids)
  if (users.length !== ids.length) {
    throw new HttpError(400, 'One or more selected team members do not exist.')
  }

  await pool.query(
    `INSERT IGNORE INTO team_members (team_id, user_id) VALUES ${ids.map(() => '(?, ?)').join(', ')}`,
    ids.flatMap((id) => [teamId, id]),
  )

  const updatedTeams = await findTeams(request.user.id)
  response.status(200).json({ team: updatedTeams.find((team) => String(team.id) === String(teamId)) })
})

router.patch('/:teamId', async (request, response) => {
  const teamId = parseResourceId(request.params.teamId, 'Team id')
  const { name, memberIds } = request.body ?? {}
  const [teams] = await pool.execute('SELECT id, name FROM teams WHERE id = ? AND lead_id = ?', [teamId, request.user.id])
  if (!teams.length) throw new HttpError(404, 'Team not found or you are not the team lead.')

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      throw new HttpError(400, 'Team name is required and must be 100 characters or fewer.')
    }
    await pool.execute(
      'UPDATE teams SET name = ? WHERE id = ? AND lead_id = ?',
      [name.trim(), teamId, request.user.id],
    )
  }

  if (Array.isArray(memberIds) && memberIds.length > 0) {
    const ids = memberIds.map(Number)
    if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)
      || new Set(ids).size !== ids.length
      || ids.some((id) => String(id) === String(request.user.id))) {
      throw new HttpError(400, 'Team members must be distinct registered users other than the team lead.')
    }
    const [users] = await pool.execute(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(', ')})`, ids)
    if (users.length !== ids.length) {
      throw new HttpError(400, 'One or more selected team members do not exist.')
    }
    await pool.query(
      `INSERT IGNORE INTO team_members (team_id, user_id) VALUES ${ids.map(() => '(?, ?)').join(', ')}`,
      ids.flatMap((id) => [teamId, id]),
    )
  }

  const updatedTeams = await findTeams(request.user.id)
  response.json({ team: updatedTeams.find((team) => String(team.id) === String(teamId)) })
})

router.delete('/:teamId', async (request, response) => {
  const teamId = parseResourceId(request.params.teamId, 'Team id')
  const [teams] = await pool.execute(
    'SELECT id FROM teams WHERE id = ? AND lead_id = ?',
    [teamId, request.user.id],
  )
  if (!teams.length) throw new HttpError(404, 'Team not found or you are not the team lead.')
  const [result] = await pool.execute(
    `DELETE FROM teams
     WHERE id = ? AND lead_id = ?
       AND NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.team_id = teams.id)`,
    [teamId, request.user.id],
  )
  if (!result.affectedRows) {
    throw new HttpError(409, 'This team still has tasks. Delete or move its tasks before deleting the team.')
  }
  response.json({ id: teamId })
})

export default router
