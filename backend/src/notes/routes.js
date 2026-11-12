import { Router } from 'express'
import { requireAuth } from '../auth/sessions.js'
import { pool } from '../db.js'
import { HttpError } from '../tasks/validation.js'
import { parseFolderId, parseNoteId, validateFolderInput, validateNoteInput } from './validation.js'

const router = Router()
router.use(requireAuth)

async function assertFolderOwned(folderId, userId) {
  if (folderId === null || folderId === undefined) return
  const [folders] = await pool.execute(
    'SELECT id FROM note_folders WHERE id = ? AND user_id = ?',
    [folderId, userId],
  )
  if (!folders.length) throw new HttpError(404, 'Folder not found.')
}

router.get('/folders', async (request, response) => {
  const [folders] = await pool.execute(
    `SELECT id, name, color, created_at AS createdAt
     FROM note_folders WHERE user_id = ? ORDER BY name, id`,
    [request.user.id],
  )
  response.json({ folders })
})

router.post('/folders', async (request, response) => {
  const values = validateFolderInput(request.body)
  const [existing] = await pool.execute(
    'SELECT id FROM note_folders WHERE user_id = ? AND LOWER(name) = LOWER(?)',
    [request.user.id, values.name],
  )
  if (existing.length) throw new HttpError(409, 'A folder with this name already exists.')
  const [result] = await pool.execute(
    'INSERT INTO note_folders (user_id, name, color) VALUES (?, ?, ?)',
    [request.user.id, values.name, values.color],
  )
  const [folders] = await pool.execute(
    'SELECT id, name, color, created_at AS createdAt FROM note_folders WHERE id = ? AND user_id = ?',
    [result.insertId, request.user.id],
  )
  response.status(201).json({ folder: folders[0] })
})

router.patch('/folders/:id', async (request, response) => {
  const id = parseFolderId(request.params.id)
  const values = validateFolderInput(request.body, { partial: true })
  const [owned] = await pool.execute(
    'SELECT id FROM note_folders WHERE id = ? AND user_id = ?',
    [id, request.user.id],
  )
  if (!owned.length) throw new HttpError(404, 'Folder not found.')
  if (values.name) {
    const [existing] = await pool.execute(
      'SELECT id FROM note_folders WHERE user_id = ? AND LOWER(name) = LOWER(?) AND id <> ?',
      [request.user.id, values.name, id],
    )
    if (existing.length) throw new HttpError(409, 'A folder with this name already exists.')
  }
  const assignments = Object.keys(values).map((field) => `\`${field}\` = ?`)
  await pool.execute(
    `UPDATE note_folders SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    [...Object.values(values), id, request.user.id],
  )
  const [folders] = await pool.execute(
    'SELECT id, name, color, created_at AS createdAt FROM note_folders WHERE id = ? AND user_id = ?',
    [id, request.user.id],
  )
  response.json({ folder: folders[0] })
})

router.delete('/folders/:id', async (request, response) => {
  const id = parseFolderId(request.params.id)
  const [owned] = await pool.execute(
    'SELECT id FROM note_folders WHERE id = ? AND user_id = ?',
    [id, request.user.id],
  )
  if (!owned.length) throw new HttpError(404, 'Folder not found.')
  await pool.execute('UPDATE notes SET folder_id = NULL WHERE folder_id = ? AND user_id = ?', [id, request.user.id])
  await pool.execute('DELETE FROM note_folders WHERE id = ? AND user_id = ?', [id, request.user.id])
  response.status(204).end()
})

router.get('/', async (request, response) => {
  const [notes] = await pool.execute(
    `SELECT id, title, content, folder_id AS folderId, created_at AS createdAt, updated_at AS updatedAt
     FROM notes
     WHERE user_id = ?
     ORDER BY updated_at DESC, id DESC`,
    [request.user.id],
  )
  response.json({ notes })
})

router.post('/', async (request, response) => {
  const values = validateNoteInput(request.body)
  const folderId = values.folder_id ?? null
  await assertFolderOwned(folderId, request.user.id)
  const [result] = await pool.execute(
    'INSERT INTO notes (user_id, title, content, folder_id) VALUES (?, ?, ?, ?)',
    [request.user.id, values.title, values.content, folderId],
  )
  const [notes] = await pool.execute(
    `SELECT id, title, content, folder_id AS folderId, created_at AS createdAt, updated_at AS updatedAt
     FROM notes
     WHERE id = ? AND user_id = ?`,
    [result.insertId, request.user.id],
  )
  response.status(201).json({ note: notes[0] })
})

router.patch('/:id', async (request, response) => {
  const id = parseNoteId(request.params.id)
  const values = validateNoteInput(request.body, { partial: true })
  await assertFolderOwned(values.folder_id, request.user.id)
  const assignments = Object.keys(values).map((field) => `\`${field}\` = ?`)
  const [result] = await pool.execute(
    `UPDATE notes SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    [...Object.values(values), id, request.user.id],
  )
  if (!result.affectedRows) {
    const [existingNotes] = await pool.execute(
      'SELECT id FROM notes WHERE id = ? AND user_id = ?',
      [id, request.user.id],
    )
    if (!existingNotes.length) throw new HttpError(404, 'Note not found.')
  }

  const [notes] = await pool.execute(
    `SELECT id, title, content, folder_id AS folderId, created_at AS createdAt, updated_at AS updatedAt
     FROM notes
     WHERE id = ? AND user_id = ?`,
    [id, request.user.id],
  )
  response.json({ note: notes[0] })
})

router.delete('/:id', async (request, response) => {
  const id = parseNoteId(request.params.id)
  const [result] = await pool.execute(
    'DELETE FROM notes WHERE id = ? AND user_id = ?',
    [id, request.user.id],
  )
  if (!result.affectedRows) throw new HttpError(404, 'Note not found.')
  response.status(204).end()
})

export default router
