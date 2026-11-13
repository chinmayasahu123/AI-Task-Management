import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { requestJson } from '../api/client'
import AnimatedList from './AnimatedList'
import Folder from './Folder'
import Icon from './Icon'

function formatUpdatedAt(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const folderColors = ['#6488d8', '#df9a4b', '#d9798a', '#55a786', '#8c75c9', '#4e9eae']

function NoteEditor({ note, folders, initialFolderId, onClose, onSave }) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [folderId, setFolderId] = useState(String(note?.folderId ?? initialFolderId ?? ''))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onSave({ title, content, folderId: folderId ? Number(folderId) : null })
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="task-modal note-editor" role="dialog" aria-modal="true" aria-labelledby="note-editor-title">
        <div className="modal-heading">
          <div><p className="eyebrow">{note ? 'UPDATE YOUR THOUGHTS' : 'CAPTURE AN IDEA'}</p><h2 id="note-editor-title">{note ? 'Edit note' : 'Create a note'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog" type="button"><Icon name="close" /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-field full-width">
            <span>Note name</span>
            <input autoFocus maxLength="120" onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Ideas for the next project" required value={title} />
          </label>
          <label className="form-field full-width">
            <span>Save in folder</span>
            <select onChange={(event) => setFolderId(event.target.value)} value={folderId}>
              <option value="">All notes (no folder)</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          </label>
          <label className="form-field full-width note-content-field">
            <span>Your thoughts</span>
            <textarea maxLength="10000" onChange={(event) => setContent(event.target.value)} placeholder="Write down an idea, reminder, or anything you want to keep..." required rows="10" value={content} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Saving...' : note ? 'Save changes' : 'Save note'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function FolderEditor({ folder, onClose, onSave }) {
  const [name, setName] = useState(folder?.name ?? '')
  const [color, setColor] = useState(folder?.color ?? folderColors[0])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onSave({ name, color })
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="task-modal folder-editor-modal" role="dialog" aria-modal="true" aria-labelledby="folder-editor-title">
        <div className="modal-heading"><div><p className="eyebrow">ORGANIZE YOUR NOTES</p><h2 id="folder-editor-title">{folder ? 'Edit folder' : 'Create a folder'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog" type="button"><Icon name="close" /></button></div>
        <form onSubmit={submit}>
          <label className="form-field full-width"><span>Folder name</span><input autoFocus maxLength="80" onChange={(event) => setName(event.target.value)} placeholder="e.g. Project ideas" required value={name} /></label>
          <fieldset className="folder-color-field"><legend>Folder color</legend><div className="folder-color-options">{folderColors.map((option) => <button aria-label={`Choose ${option} folder color`} aria-pressed={color === option} className="folder-color-swatch" key={option} onClick={() => setColor(option)} style={{ '--swatch-color': option }} type="button" />)}</div></fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">Cancel</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Saving...' : folder ? 'Save folder' : 'Create folder'}</button></div>
        </form>
      </section>
    </div>
  )
}

const NotesPage = forwardRef(function NotesPage({ isDarkMode }, ref) {
  const [notes, setNotes] = useState([])
  const [folders, setFolders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingNote, setEditingNote] = useState(null)
  const [initialFolderId, setInitialFolderId] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState(null)
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false)
  const [activeFolderId, setActiveFolderId] = useState('all')
  const [maximizedNoteId, setMaximizedNoteId] = useState(null)
  const [draggingNoteId, setDraggingNoteId] = useState(null)
  const [dragOverFolderId, setDragOverFolderId] = useState(null)

  useEffect(() => {
    let active = true
    Promise.allSettled([requestJson('/api/notes'), requestJson('/api/notes/folders')])
      .then(([notesResult, foldersResult]) => {
        if (!active) return
        if (notesResult.status === 'fulfilled') setNotes(notesResult.value.notes)
        if (foldersResult.status === 'fulfilled') setFolders(foldersResult.value.folders)
        const failed = [notesResult, foldersResult].find((result) => result.status === 'rejected')
        if (failed) setError(failed.reason.message)
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => {
      active = false
    }
  }, [])

  useImperativeHandle(ref, () => ({
    create(folderId = '') {
      setEditingNote(null)
      setInitialFolderId(folderId ? String(folderId) : '')
      setIsEditorOpen(true)
    },
  }), [])

  useEffect(() => {
    if (!maximizedNoteId) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') setMaximizedNoteId(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [maximizedNoteId])

  const visibleNotes = useMemo(() => {
    if (activeFolderId === 'all') return notes
    return notes.filter((note) => String(note.folderId) === String(activeFolderId))
  }, [activeFolderId, notes])
  const activeFolder = folders.find((folder) => String(folder.id) === String(activeFolderId))
  const maximizedNote = notes.find((note) => String(note.id) === String(maximizedNoteId))

  async function saveNote(values) {
    const path = editingNote ? `/api/notes/${editingNote.id}` : '/api/notes'
    const result = await requestJson(path, {
      method: editingNote ? 'PATCH' : 'POST',
      body: JSON.stringify(values),
    })
    setNotes((current) => [
      result.note,
      ...current.filter((note) => String(note.id) !== String(result.note.id)),
    ])
    setActiveFolderId(result.note.folderId ? String(result.note.folderId) : 'all')
    setIsEditorOpen(false)
    setEditingNote(null)
    setInitialFolderId('')
    setError('')
  }

  async function saveFolder(values) {
    const path = editingFolder ? `/api/notes/folders/${editingFolder.id}` : '/api/notes/folders'
    const result = await requestJson(path, {
      method: editingFolder ? 'PATCH' : 'POST',
      body: JSON.stringify(values),
    })
    setFolders((current) => {
      const updated = [...current.filter((folder) => String(folder.id) !== String(result.folder.id)), result.folder]
      return updated.sort((a, b) => a.name.localeCompare(b.name))
    })
    setIsFolderEditorOpen(false)
    setEditingFolder(null)
    setError('')
  }

  async function deleteFolder(folder) {
    if (!window.confirm(`Delete "${folder.name}"? Its notes will remain in All notes without a folder.`)) return
    try {
      await requestJson(`/api/notes/folders/${folder.id}`, { method: 'DELETE' })
      setFolders((current) => current.filter((item) => String(item.id) !== String(folder.id)))
      setNotes((current) => current.map((note) => String(note.folderId) === String(folder.id) ? { ...note, folderId: null } : note))
      if (String(activeFolderId) === String(folder.id)) setActiveFolderId('all')
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function moveNoteToFolder(noteId, folderId) {
    try {
      const result = await requestJson(`/api/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ folderId }),
      })
      setNotes((current) => current.map((note) => String(note.id) === String(noteId) ? result.note : note))
      setActiveFolderId(String(folderId))
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDraggingNoteId(null)
      setDragOverFolderId(null)
    }
  }

  function openNoteEditor(note) {
    setMaximizedNoteId(null)
    setEditingNote(note)
    setInitialFolderId('')
    setIsEditorOpen(true)
  }

  async function deleteNote(note) {
    if (!window.confirm(`Delete "${note.title}"? This cannot be undone.`)) return
    const previousNotes = notes
    setNotes((current) => current.filter((item) => String(item.id) !== String(note.id)))
    if (String(maximizedNoteId) === String(note.id)) setMaximizedNoteId(null)
    let deleted = false
    try {
      await requestJson(`/api/notes/${note.id}`, { method: 'DELETE' })
      deleted = true
      const result = await requestJson('/api/notes')
      setNotes(result.notes)
      setError('')
    } catch (requestError) {
      if (!deleted) setNotes(previousNotes)
      setError(requestError.message)
    }
  }

  return (
    <>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}
      {isLoading ? (
        <div className="loading-state"><span className="spinner" />Loading your notes...</div>
      ) : (
        <>
          <section className="notes-folder-section" aria-labelledby="notes-folders-heading">
            <div className="notes-section-heading"><div><p className="eyebrow">KEEP THINGS ORGANIZED</p><h2 id="notes-folders-heading">Your folders</h2><p>Open a folder to browse its notes. Choose a color that makes it easy to spot.</p></div><button className="secondary-button" onClick={() => { setEditingFolder(null); setIsFolderEditorOpen(true) }} type="button"><Icon name="plus" size={15} /> New folder</button></div>
            <div className="notes-folder-grid">
              {folders.map((folder) => {
                const folderNotes = notes.filter((note) => String(note.folderId) === String(folder.id))
                const folderId = String(folder.id)
                return <article
                  className={`notes-folder-card${activeFolderId === folderId ? ' is-active' : ''}${dragOverFolderId === folderId ? ' is-drop-target' : ''}`}
                  key={folder.id}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
                  onDrop={(event) => { event.preventDefault(); const noteId = event.dataTransfer.getData('text/plain'); if (noteId) moveNoteToFolder(noteId, folderId) }}
                  onDragEnter={() => setDragOverFolderId(folderId)}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOverFolderId(null) }}
                  style={{ '--note-folder-color': folder.color }}
                >
                  <div className="notes-folder-art"><Folder
                    color={folder.color}
                    draggable={false}
                    intro={false}
                    label={folder.name}
                    layout="spread"
                    onItemClick={(_item, index) => folderNotes[index] && setMaximizedNoteId(folderNotes[index].id)}
                    onOpenChange={(open) => open && setActiveFolderId(folderId)}
                    openOn="click"
                    paperColor="#fffdf8"
                    peek
                    size={0.82}
                    theme={isDarkMode ? 'dark' : 'light'}
                    tilt={0.35}
                    zoomOnClick={false}
                  >{folderNotes.length ? folderNotes.slice(0, 6).map((note, index) => <div className={`folder-note-preview note-color-${['yellow', 'peach', 'pink', 'mint', 'lavender'][index % 5]}`} key={note.id}><strong>{note.title}</strong><span>{note.content.slice(0, 85)}</span></div>) : <div className="folder-note-preview folder-note-empty">Drop a note here</div>}</Folder></div>
                  <div className="notes-folder-meta"><div className="notes-folder-info"><h3 title={folder.name}>{folder.name}</h3><p>{folderNotes.length} {folderNotes.length === 1 ? 'note' : 'notes'}</p></div><div className="notes-folder-actions">
                    <button className="notes-folder-add" aria-label={`Add note to ${folder.name}`} onClick={() => ref.current?.create(folder.id)} title="Add note" type="button"><Icon name="plus" size={13} /> <span>Note</span></button>
                    <button className="notes-folder-edit" aria-label={`Edit ${folder.name}`} onClick={() => { setEditingFolder(folder); setIsFolderEditorOpen(true) }} title="Edit folder" type="button"><Icon name="settings" size={13} /></button>
                    <button className="notes-folder-delete" aria-label={`Delete ${folder.name}`} onClick={() => deleteFolder(folder)} title="Delete folder" type="button"><Icon name="close" size={13} /></button>
                  </div></div>
                </article>
              })}
            </div>
          </section>

          <section className="notes-content-section" aria-labelledby="notes-list-heading">
            <div className="notes-section-heading notes-list-heading"><div><p className="eyebrow">YOUR THOUGHTS</p><h2 id="notes-list-heading">{activeFolder ? activeFolder.name : 'All notes'}</h2></div>
              <div className="notes-filter-tabs"><button className={activeFolderId === 'all' ? 'is-active' : ''} onClick={() => setActiveFolderId('all')} type="button">All notes</button>{folders.map((folder) => <button className={activeFolderId === String(folder.id) ? 'is-active' : ''} key={folder.id} onClick={() => setActiveFolderId(String(folder.id))} type="button">{folder.name}</button>)}</div>
            </div>
            {visibleNotes.length ? <AnimatedList as="section" className="notes-grid" aria-label="Your notes" stagger={0.06}>
              {visibleNotes.map((note, index) => (
                <article className={`panel note-card note-color-${['yellow', 'peach', 'pink', 'mint', 'lavender'][index % 5]}${draggingNoteId === String(note.id) ? ' is-dragging' : ''}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(note.id)); setDraggingNoteId(String(note.id)) }} onDragEnd={() => { setDraggingNoteId(null); setDragOverFolderId(null) }} key={note.id}>
              <div className="note-card-heading">
                <span className="note-card-icon"><Icon name="note" size={18} /></span>
                <div className="note-card-actions">
                  <button className="icon-button" onClick={() => setMaximizedNoteId(note.id)} aria-label={`Maximize ${note.title}`} title="Maximize note" type="button"><Icon name="expand" size={16} /></button>
                  <button className="icon-button" onClick={() => openNoteEditor(note)} aria-label={`Edit ${note.title}`} title="Edit note" type="button"><Icon name="settings" size={16} /></button>
                  <button className="icon-button note-delete-button" onClick={() => deleteNote(note)} aria-label={`Delete ${note.title}`} title="Delete note" type="button"><Icon name="close" size={16} /></button>
                </div>
              </div>
              <h2>{note.title}</h2>
              <p className="note-card-content">{note.content}</p>
              <time className="note-card-date" dateTime={note.updatedAt}>Updated {formatUpdatedAt(note.updatedAt)}</time>
            </article>
              ))}
            </AnimatedList> : <section className="panel empty-state notes-empty-state"><span className="empty-icon"><Icon name="note" size={19} /></span><strong>{notes.length ? 'No notes in this folder' : 'No notes yet'}</strong><p>Drag a note card here to move it into this folder, or create a note here.</p><button className="secondary-button" onClick={() => ref.current?.create(activeFolderId === 'all' ? '' : activeFolderId)} type="button"><Icon name="plus" size={16} /> Create a note</button></section>}
          </section>
        </>
      )}
      {maximizedNote && <div className="note-maximize-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMaximizedNoteId(null)}><article className={`note-card note-color-${['yellow', 'peach', 'pink', 'mint', 'lavender'][notes.findIndex((note) => String(note.id) === String(maximizedNote.id)) % 5]} note-maximized-card`} role="dialog" aria-modal="true" aria-label={maximizedNote.title}><div className="note-maximized-heading"><span className="note-card-icon"><Icon name="note" size={19} /></span><div><button className="icon-button" onClick={() => openNoteEditor(maximizedNote)} aria-label={`Edit ${maximizedNote.title}`} title="Edit note" type="button"><Icon name="settings" size={16} /></button><button className="icon-button" onClick={() => setMaximizedNoteId(null)} aria-label="Close maximized note" title="Close" type="button"><Icon name="close" size={17} /></button></div></div><h2>{maximizedNote.title}</h2><p className="note-maximized-content">{maximizedNote.content}</p><time className="note-card-date" dateTime={maximizedNote.updatedAt}>Updated {formatUpdatedAt(maximizedNote.updatedAt)}</time></article></div>}
      {isEditorOpen && (
        <NoteEditor
          key={editingNote?.id ?? 'new'}
          note={editingNote}
          folders={folders}
          initialFolderId={initialFolderId}
          onClose={() => { setIsEditorOpen(false); setEditingNote(null) }}
          onSave={saveNote}
        />
      )}
      {isFolderEditorOpen && <FolderEditor folder={editingFolder} onClose={() => { setIsFolderEditorOpen(false); setEditingFolder(null) }} onSave={saveFolder} />}
    </>
  )
})

export default NotesPage
