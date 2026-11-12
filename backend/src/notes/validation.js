import { HttpError } from '../tasks/validation.js'

export function parseNoteId(value) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, 'Note id must be a positive integer.')
  }
  return id
}

export function parseFolderId(value) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, 'Folder id must be a positive integer.')
  }
  return id
}

export function validateNoteInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }

  const values = {}
  for (const [field, rules] of Object.entries({
    title: { max: 120 },
    content: { max: 10000 },
  })) {
    if (!(field in body)) {
      if (!partial) throw new HttpError(400, `${field} is required.`)
      continue
    }

    if (typeof body[field] !== 'string') throw new HttpError(400, `${field} must be a string.`)
    const value = body[field].trim()
    if (!value) throw new HttpError(400, `${field} is required.`)
    if (value.length > rules.max) throw new HttpError(400, `${field} must be ${rules.max} characters or fewer.`)
    values[field] = value
  }

  if ('folderId' in body) {
    if (body.folderId === null || body.folderId === '') {
      values.folder_id = null
    } else {
      const folderId = Number(body.folderId)
      if (!Number.isSafeInteger(folderId) || folderId < 1) throw new HttpError(400, 'Folder id must be a positive integer or null.')
      values.folder_id = folderId
    }
  }

  if (partial && !Object.keys(values).length) {
    throw new HttpError(400, 'Provide a title, content, or folder to update.')
  }
  return values
}

export function validateFolderInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }
  const values = {}
  if ('name' in body) {
    if (typeof body.name !== 'string') throw new HttpError(400, 'Folder name must be a string.')
    const name = body.name.trim()
    if (!name) throw new HttpError(400, 'Folder name is required.')
    if (name.length > 80) throw new HttpError(400, 'Folder name must be 80 characters or fewer.')
    values.name = name
  } else if (!partial) {
    throw new HttpError(400, 'Folder name is required.')
  }
  if ('color' in body) {
    if (typeof body.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      throw new HttpError(400, 'Folder color must be a six-digit hex color.')
    }
    values.color = body.color.toLowerCase()
  } else if (!partial) {
    values.color = '#6488d8'
  }
  if (partial && !Object.keys(values).length) throw new HttpError(400, 'Provide a folder name or color to update.')
  return values
}
