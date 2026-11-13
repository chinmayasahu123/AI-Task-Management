import { useMemo, useState } from 'react'
import Avatar from './Avatar'
import Icon from './Icon'

export default function TeamModal({ team, users, currentUser, onClose, onSave }) {
  const [name, setName] = useState(team?.name ?? '')
  const [memberIds, setMemberIds] = useState([])
  const [inviteEmails, setInviteEmails] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const currentMemberIds = useMemo(() => new Set(team?.members?.map((m) => String(m.id)) ?? []), [team])

  const availableUsers = useMemo(() => {
    return users.filter((member) => {
      if (String(member.id) === String(currentUser.id)) return false
      if (team && currentMemberIds.has(String(member.id))) return false
      return true
    })
  }, [users, currentUser.id, team, currentMemberIds])

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
      await onSave({
        name,
        memberIds,
        inviteEmails: inviteEmails.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean),
      })
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
          <div><p className="eyebrow">TEAM WORKSPACE</p><h2 id="team-modal-title">{team ? 'Edit team & members' : 'Create a team'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog" type="button"><Icon name="close" /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-field full-width">
            <span>Team name</span>
            <input autoFocus maxLength="100" onChange={(event) => setName(event.target.value)} placeholder="e.g. Product team" required value={name} />
          </label>

          {team && team.members?.length > 0 && (
            <div className="team-current-members-section">
              <span className="team-current-members-label">Current members ({team.members.length}):</span>
              <div className="team-current-members-list">
                {team.members.map((member) => (
                  <span className="team-member-chip" key={member.id}>
                    <Avatar name={member.name} src={member.avatarUrl} />
                    <span>{member.name}</span>
                    {member.isLead && <small>(Lead)</small>}
                  </span>
                ))}
              </div>
            </div>
          )}

          <fieldset className="team-member-picker">
            <legend>{team ? 'Add registered members' : 'Choose registered team members'}</legend>
            {availableUsers.map((member) => (
              <label className="team-member-option" key={member.id}>
                <input checked={memberIds.includes(String(member.id))} onChange={() => toggleMember(member.id)} type="checkbox" />
                <Avatar name={member.name} src={member.avatarUrl} />
                <span>{member.name}</span>
              </label>
            ))}
            {!availableUsers.length && (
              <p className="team-empty-members">
                {team
                  ? 'All other registered accounts are already in this team.'
                  : 'No other registered accounts are available yet. Team members need to register before they can be added.'}
              </p>
            )}
          </fieldset>

          <label className="form-field full-width">
            <span>{team ? 'Invite new members by email (comma or line separated)' : 'Invite by email (comma or line separated)'}</span>
            <textarea onChange={(event) => setInviteEmails(event.target.value)} placeholder="teammate@example.com" rows="3" value={inviteEmails} />
          </label>

          <p className="assignment-note">
            {team
              ? 'Added members will immediately gain access to this team and its shared tasks.'
              : 'You’ll be the team lead. Every team member can see everyone’s progress, and you can manage team tasks.'}
          </p>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={isSaving || !name.trim() || (!team && memberIds.length === 0 && !inviteEmails.trim())} type="submit">
              {isSaving ? (team ? 'Saving...' : 'Creating...') : (team ? 'Save changes' : 'Create team')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
