import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpError } from '../src/tasks/validation.js'
import { parseNoteId, validateNoteInput } from '../src/notes/validation.js'

test('validates and trims a complete note', () => {
  assert.deepEqual(validateNoteInput({ title: '  Idea  ', content: '  Save this thought.  ' }), {
    title: 'Idea',
    content: 'Save this thought.',
  })
})

test('validates partial note updates and rejects empty updates', () => {
  assert.deepEqual(validateNoteInput({ content: 'Updated thought' }, { partial: true }), {
    content: 'Updated thought',
  })
  assert.throws(() => validateNoteInput({}, { partial: true }), HttpError)
})

test('rejects empty or oversized note fields', () => {
  assert.throws(() => validateNoteInput({ title: ' ', content: 'Thought' }), /title is required/)
  assert.throws(() => validateNoteInput({ title: 'Idea', content: ' ' }), /content is required/)
  assert.throws(() => validateNoteInput({ title: 'x'.repeat(121), content: 'Thought' }), /120 characters/)
  assert.throws(() => validateNoteInput({ title: 'Idea', content: 'x'.repeat(10001) }), /10000 characters/)
})

test('validates note IDs', () => {
  assert.equal(parseNoteId('12'), 12)
  assert.throws(() => parseNoteId('0'), /positive integer/)
  assert.throws(() => parseNoteId('1; DROP TABLE notes'), /positive integer/)
})
