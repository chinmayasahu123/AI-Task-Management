import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpError, parseTaskId, validateTaskInput, validateTaskStatus } from '../src/tasks/validation.js'

const validTask = {
  title: 'Review landing page',
  project: 'Website Redesign',
  assigneeId: 7,
  priority: 'high',
  status: 'in_progress',
  dueDate: '2026-11-12',
  description: 'Check the final copy.',
}

test('validates and maps a complete task to database fields', () => {
  assert.deepEqual(validateTaskInput(validTask), {
    title: 'Review landing page',
    project: 'Website Redesign',
    assignee_id: 7,
    description: 'Check the final copy.',
    priority: 'high',
    status: 'in_progress',
    due_date: '2026-11-12',
  })
})

test('applies defaults when creating a task without optional status fields', () => {
  const { status, priority, due_date: dueDate } = validateTaskInput({
    title: 'Review landing page',
    project: 'Website Redesign',
    assigneeId: 7,
    dueDate: '2026-11-12',
  })
  assert.equal(status, 'pending')
  assert.equal(priority, 'medium')
  assert.equal(dueDate, '2026-11-12')
})

test('validates optional task time estimates', () => {
  assert.equal(validateTaskInput({ ...validTask, estimatedMinutes: 90 }).estimated_minutes, 90)
  assert.equal(validateTaskInput({ ...validTask, estimatedMinutes: null }).estimated_minutes, null)
  assert.throws(() => validateTaskInput({ ...validTask, estimatedMinutes: 0 }), /between 1 minute and 168 hours/)
  assert.throws(() => validateTaskInput({ ...validTask, estimatedMinutes: 10081 }), /between 1 minute and 168 hours/)
  assert.throws(() => validateTaskInput({ ...validTask, estimatedMinutes: 1.5 }), /between 1 minute and 168 hours/)
})

test('accepts a partial update and rejects an empty update', () => {
  assert.deepEqual(validateTaskInput({ status: 'completed' }, { partial: true }), { status: 'completed' })
  assert.throws(() => validateTaskInput({}, { partial: true }), HttpError)
})

test('rejects invalid priorities, statuses, and calendar dates', () => {
  assert.throws(() => validateTaskInput({ ...validTask, priority: 'urgent' }), /Priority must/)
  assert.throws(() => validateTaskInput({ ...validTask, status: 'blocked' }), /Status must/)
  assert.throws(() => validateTaskInput({ ...validTask, dueDate: '2026-02-30' }), /valid date/)
  assert.throws(() => validateTaskInput({ ...validTask, assigneeId: -1 }), /valid user/)
})

test('validates team assignment and supports detailed task notes', () => {
  const teamTask = validateTaskInput({ ...validTask, teamId: '4', description: 'x'.repeat(5000) })
  assert.equal(teamTask.team_id, 4)
  assert.equal(teamTask.description.length, 5000)
  assert.equal(validateTaskInput({ ...validTask, teamId: null }).team_id, null)
  assert.throws(() => validateTaskInput({ ...validTask, teamId: 'invalid' }), /valid team/)
  assert.throws(() => validateTaskInput({ ...validTask, description: 'x'.repeat(5001) }), /5000 characters/)
})

test('validates per-member progress statuses', () => {
  assert.equal(validateTaskStatus('in_progress'), 'in_progress')
  assert.throws(() => validateTaskStatus('blocked'), /Status must/)
})

test('rejects malformed task ids', () => {
  assert.equal(parseTaskId('12'), 12)
  assert.throws(() => parseTaskId('0'), /positive integer/)
  assert.throws(() => parseTaskId('1; DROP TABLE tasks'), /positive integer/)
})
