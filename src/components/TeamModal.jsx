import { useState } from 'react'
import Avatar from './Avatar'
import Icon from './Icon'

export default function TeamModal({ team, users, currentUser, onClose, onSave }) {
  const [name, setName] = useState(team?.name ?? '')
  const [memberIds, setMemberIds] = useState([])
  const [inviteEmails, setInviteEmails] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function toggleMember(id) {
    setMemberIds((selected) => selected.includes(String(id))
      ? selected.filter((selectedId) => selectedId !== String(id))
      : [...selected, String(id)])
  }

  async function submit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onSave({ name, memberIds, inviteEmails: inviteEmails.split(/[\n,;]+/).map((email)=>email.trim()).filter(Boolean) })
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="task-modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
        <div className="modal-heading">
          <div><p className="eyebrow">TEAM WORKSPACE</p><h2 id="team-modal-title">{team ? 'Edit team' : 'Create a team'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog" type="button"><Icon name="close" /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-field full-width">
            <span>Team name</span>
            <input autoFocus maxLength="100" onChange={(event) => setName(event.target.value)} placeholder="e.g. Product team" required value={name} />
          </label>
          {!team && <fieldset className="team-member-picker">
            <legend>Choose registered team members</legend>
            {users.filter((member) => String(member.id) !== String(currentUser.id)).map((member) => (
              <label className="team-member-option" key={member.id}>
                <input checked={memberIds.includes(String(member.id))} onChange={() => toggleMember(member.id)} type="checkbox" />
                <Avatar name={member.name} src={member.avatarUrl} />
                <span>{member.name}</span>
              </label>
            ))}
            {!users.some((member) => String(member.id) !== String(currentUser.id)) && (
              <p className="team-empty-members">No other registered accounts are available yet. Team members need to register before they can be added.</p>
            )}
          </fieldset>}
          {!team && <label className="form-field full-width"><span>Invite by email (comma or line separated)</span><textarea onChange={(event)=>setInviteEmails(event.target.value)} placeholder="teammate@example.com" rows="3" value={inviteEmails}/></label>}
          <p className="assignment-note">{team ? 'Editing the team name does not change its members or existing tasks.' : 'You’ll be the team lead. Every team member can see everyone’s progress, and you can manage team tasks.'}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={isSaving || (!team && memberIds.length === 0 && !inviteEmails.trim())} type="submit">{isSaving ? (team ? 'Saving...' : 'Creating...') : (team ? 'Save changes' : 'Create team')}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
