const priorities = new Set(['high', 'medium', 'low'])
const statuses = new Set(['pending', 'in_progress', 'completed'])

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseTaskId(value) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Task id must be a positive integer.')
  return id
}

export function validateTaskInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }

  const fields = {
    title: { max: 160, required: true },
    project: { max: 80, required: true },
    description: { max: 5000, required: false },
  }
  const values = {}

  for (const [field, rules] of Object.entries(fields)) {
    if (!(field in body)) {
      if (!partial && rules.required) throw new HttpError(400, `${field} is required.`)
      continue
    }

    if (typeof body[field] !== 'string') throw new HttpError(400, `${field} must be a string.`)
    const value = body[field].trim()
    if (rules.required && !value) throw new HttpError(400, `${field} is required.`)
    if (value.length > rules.max) throw new HttpError(400, `${field} must be ${rules.max} characters or fewer.`)
    values[field] = value
  }

  if ('assigneeId' in body) {
    const assigneeId = Number(body.assigneeId)
    if (!Number.isSafeInteger(assigneeId) || assigneeId < 1) {
      throw new HttpError(400, 'Assignee must be a valid user.')
    }
    values.assignee_id = assigneeId
  } else if (!partial) {
    throw new HttpError(400, 'assigneeId is required.')
  }

  if ('teamId' in body) {
    if (body.teamId === null || body.teamId === '') {
      values.team_id = null
    } else {
      const teamId = Number(body.teamId)
      if (!Number.isSafeInteger(teamId) || teamId < 1) {
        throw new HttpError(400, 'Team must be a valid team.')
      }
      values.team_id = teamId
    }
  }

  if ('priority' in body) {
    if (!priorities.has(body.priority)) throw new HttpError(400, 'Priority must be high, medium, or low.')
    values.priority = body.priority
  } else if (!partial) {
    values.priority = 'medium'
  }

  if ('status' in body) {
    if (!statuses.has(body.status)) throw new HttpError(400, 'Status must be pending, in_progress, or completed.')
    values.status = body.status
  } else if (!partial) {
    values.status = 'pending'
  }

  if ('dueDate' in body) {
    if (typeof body.dueDate !== 'string' || !validateDate(body.dueDate)) {
      throw new HttpError(400, 'Due date must be a valid date in YYYY-MM-DD format.')
    }
    values.due_date = body.dueDate
  } else if (!partial) {
    throw new HttpError(400, 'dueDate is required.')
  }

  if ('estimatedMinutes' in body) {
    if (body.estimatedMinutes === null || body.estimatedMinutes === '') {
      values.estimated_minutes = null
    } else {
      const estimatedMinutes = Number(body.estimatedMinutes)
      if (!Number.isSafeInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 10080) {
        throw new HttpError(400, 'Task estimate must be between 1 minute and 168 hours.')
      }
      values.estimated_minutes = estimatedMinutes
    }
  }

  if (!Object.keys(values).length) throw new HttpError(400, 'Provide at least one task field to update.')
  return values
}

export function validateTaskStatus(value) {
  if (!statuses.has(value)) {
    throw new HttpError(400, 'Status must be pending, in_progress, or completed.')
  }
  return value
}
