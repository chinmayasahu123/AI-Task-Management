import { useState } from 'react'
import Icon from './Icon'
import TaskCollaborationPanel from './TaskCollaborationPanel'

export default function TaskModal({ task, users, teams, allTasks, currentUser, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: task?.title ?? '',
    project: task?.project ?? '',
    assigneeId: String(task?.assigneeId ?? currentUser.id),
    teamId: task?.teamId ? String(task.teamId) : '',
    taskKind: task?.teamId ? 'team' : 'individual',
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? new Date().toISOString().slice(0, 10),
    status: task?.status ?? 'pending',
    description: task?.description ?? '',
    estimateHours: String(Math.floor((task?.estimatedMinutes ?? 0) / 60)),
    estimateRemainderMinutes: String((task?.estimatedMinutes ?? 0) % 60),
  }))
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function changeField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const manageableTeams = teams.filter((team) => String(team.leadId) === String(currentUser.id))
  const selectedTeam = manageableTeams.find((team) => String(team.id) === form.teamId)

  function chooseTaskKind(taskKind) {
    setForm((current) => ({
      ...current,
      taskKind,
      teamId: taskKind === 'team'
        ? current.teamId || String(manageableTeams[0]?.id ?? '')
        : '',
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setIsSaving(true)
    setSaveError('')
    try {
      const estimateMinutes = Number(form.estimateHours) * 60 + Number(form.estimateRemainderMinutes)
      if (estimateMinutes > 10080) throw new Error('Task estimate cannot exceed 168 hours.')
      await onSave({
        ...form,
        estimatedMinutes: estimateMinutes || null,
      })
    } catch (error) {
      setSaveError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><p className="eyebrow">{task ? 'UPDATE YOUR WORK' : 'ADD TO YOUR WORKSPACE'}</p><h2 id="modal-title">{task ? 'Edit task' : 'Create a task'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog" type="button"><Icon name="close" /></button></div>
        <form id="task-main-form" onSubmit={submit}>
          <label className="form-field full-width"><span>Task name</span><input autoFocus maxLength="160" name="title" onChange={changeField} placeholder="e.g. Review the new landing page" required value={form.title} /></label>
          <div className="form-grid">
            <label className="form-field"><span>Project</span><input maxLength="80" name="project" onChange={changeField} placeholder="e.g. Website Redesign" required value={form.project} /></label>
            <div className="form-field full-width">
              <span>Task type</span>
              <div aria-label="Task type" className="task-kind-options" role="group">
                <button
                  aria-pressed={form.taskKind === 'individual'}
                  className={form.taskKind === 'individual' ? 'selected' : ''}
                  onClick={() => chooseTaskKind('individual')}
                  type="button"
                >Individual task</button>
                {manageableTeams.length > 0 && (
                  <button
                    aria-pressed={form.taskKind === 'team'}
                    className={form.taskKind === 'team' ? 'selected' : ''}
                    onClick={() => chooseTaskKind('team')}
                    type="button"
                  >Team task</button>
                )}
              </div>
              {form.taskKind === 'team' && manageableTeams.length > 0 && (
                <label className="form-field team-select-field"><span>Select team</span>
                  <select name="teamId" onChange={changeField} required value={form.teamId}>
                    {manageableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </label>
              )}
              {manageableTeams.length === 0 && <span className="optional-label">Create a team first to assign a task to team members.</span>}
            </div>
            {!selectedTeam && <label className="form-field"><span>Assign to</span><select name="assigneeId" onChange={changeField} required value={form.assigneeId}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{String(user.id) === String(currentUser.id) ? ' (you)' : ''}</option>)}</select></label>}
            <label className="form-field"><span>Priority</span><select name="priority" onChange={changeField} value={form.priority}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label className="form-field"><span>Due date</span><input name="dueDate" onChange={changeField} required type="date" value={form.dueDate} /></label>
            {!selectedTeam && <label className="form-field full-width"><span>Status</span><select name="status" onChange={changeField} value={form.status}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>}
            <div className="form-field full-width">
              <span>Time estimate <span className="optional-label">Optional</span></span>
              <div className="estimate-fields">
                <label><input aria-label="Estimate hours" max="168" min="0" name="estimateHours" onChange={changeField} type="number" value={form.estimateHours} /><span>hours</span></label>
                <label><input aria-label="Estimate minutes" max="59" min="0" name="estimateRemainderMinutes" onChange={changeField} type="number" value={form.estimateRemainderMinutes} /><span>minutes</span></label>
              </div>
              <span className="optional-label">The timer starts when the task is marked In Progress and pauses when it leaves that status.</span>
            </div>
            <label className="form-field full-width"><span>Task details / what needs to be done {selectedTeam ? <span className="optional-label">(Required for team tasks)</span> : <span className="optional-label">Optional</span>}</span><textarea maxLength="5000" name="description" onChange={changeField} placeholder={selectedTeam ? 'Write the steps, expectations, and any information the team needs...' : 'Add a few details about this task...'} required={Boolean(selectedTeam)} rows="5" value={form.description} /></label>
          </div>
          {selectedTeam ? (
            <div className="task-team-roster">
              <strong>{selectedTeam.name} members</strong>
              <div>{selectedTeam.members.map((member) => <span className="task-team-member" key={member.id}>{member.name}{member.isLead ? ' · Lead' : ''}</span>)}</div>
              <p className="assignment-note">Every team member is assigned and can see everyone’s progress. Each member updates their own status.</p>
            </div>
          ) : <p className="assignment-note">Only you and the selected assignee can see this task.</p>}
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
        </form>
        {task && <TaskCollaborationPanel task={task} allTasks={allTasks} />}
        <div className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">Cancel</button><button className="primary-button" disabled={isSaving} form="task-main-form" type="submit">{isSaving ? 'Saving...' : task ? 'Save changes' : 'Create task'}</button></div>
      </section>
    </div>
  )
}
