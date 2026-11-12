import Avatar from './Avatar'
import AnimatedList from './AnimatedList'
import EmptyState from './EmptyState'
import Icon from './Icon'
import LoadingState from './LoadingState'
import PriorityBadge from './PriorityBadge'
import { formatDate } from '../utils/date'
import { getTaskStatus } from '../utils/task'
import { formatDuration, getElapsedSeconds } from '../utils/taskTime'

export default function TaskTable({
  title,
  tasks,
  isLoading,
  search = '',
  onSearch,
  onCreate,
  onEdit,
  onDelete,
  onToggle,
  onProgress,
  openMenuId,
  setOpenMenuId,
  onViewAll,
  timerNow = 0,
}) {
  return (
    <section className="panel task-panel">
      <div className="task-panel-heading">
        <div><p className="eyebrow">YOUR WORK</p><h2>{title}</h2></div>
        <div className="table-actions">
          {onSearch && (
            <label className="search-field">
              <Icon name="search" size={17} />
              <input aria-label="Search tasks" onChange={(event) => onSearch(event.target.value)} placeholder="Search tasks..." value={search} />
            </label>
          )}
          {onViewAll && <button className="text-button" onClick={onViewAll} type="button">View all<Icon name="arrow" size={14} /></button>}
        </div>
      </div>
      {isLoading ? <LoadingState /> : tasks.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th className="check-col"><span className="sr-only">Done</span></th><th>Task</th><th>Project</th><th>Assignee</th><th>Priority</th><th>Due date</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <AnimatedList as="tbody" stagger={0.04}>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td className="check-col">{task.isTeamTask ? <span className="sr-only">Team task progress is tracked per member</span> : <button className={`task-check ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => onToggle(task)} aria-label={task.status === 'completed' ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} type="button">{task.status === 'completed' && <Icon name="check" size={12} />}</button>}</td>
                  <td>
                    {task.canManage
                      ? <button className={`task-title ${task.status === 'completed' ? 'is-completed' : ''}`} onClick={() => onEdit(task)} type="button">{task.title}</button>
                      : <span className={`task-title ${task.status === 'completed' ? 'is-completed' : ''}`}>{task.title}</span>}
                    <span className="task-mobile-project">{task.project}</span>
                    {task.isTeamTask && <p className="task-inline-description">{task.description}</p>}
                    {(task.estimatedMinutes || task.elapsedSeconds > 0) && (
                      <span className="task-time">
                        Tracked {formatDuration(getElapsedSeconds(task, timerNow))}
                        {task.estimatedMinutes ? ` / ${formatDuration(task.estimatedMinutes * 60)} estimate` : ''}
                        {task.timerRunning && <span className="task-timer-running">Running</span>}
                      </span>
                    )}
                  </td>
                  <td><span className="project-cell"><span className={`project-dot ${['blue', 'green', 'purple', 'orange'][task.project.length % 4]}`} />{task.project}</span></td>
                  <td>{task.isTeamTask ? (
                    <div className="team-task-assignees">
                      <strong>{task.teamName}</strong>
                      <AnimatedList className="team-task-member-list" stagger={0.035}>
                      {task.teamMembers.map((member) => (
                        <div className="team-task-member" key={member.id}>
                          <Avatar name={member.name} src={member.avatarUrl} />
                          <span>{member.name}{member.isLead ? ' · Lead' : ''}</span>
                          <span className={`team-member-status ${member.status ?? 'unknown'}`}>{member.status?.replace('_', ' ') ?? 'status unavailable'}</span>
                        </div>
                      ))}
                      </AnimatedList>
                    </div>
                  ) : <span className="assignee-cell"><Avatar name={task.assignee} src={task.assigneeAvatarUrl} /><span>{task.assignee}</span></span>}</td>
                  <td><PriorityBadge priority={task.priority} /></td>
                  <td className={getTaskStatus(task) === 'overdue' ? 'overdue-date' : ''}>{formatDate(task.dueDate)}</td>
                  <td>
                    {task.isTeamTask ? (
                      <div className="team-progress-cell">
                        <span className={`status-badge ${getTaskStatus(task)}`}>Team: {getTaskStatus(task).replace('_', ' ')}</span>
                        <label className="team-progress-control">
                          <span className="sr-only">Your progress on {task.title}</span>
                          <select aria-label={`Your progress on ${task.title}`} onChange={(event) => onProgress(task, event.target.value)} value={task.myStatus}>
                            <option value="pending">Your status: Pending</option>
                            <option value="in_progress">Your status: In progress</option>
                            <option value="completed">Your status: Completed</option>
                          </select>
                        </label>
                      </div>
                    ) : (
                      <label className="task-status-control">
                        <span className="sr-only">Status for {task.title}</span>
                        <select aria-label={`Status for ${task.title}`} onChange={(event) => onToggle(task, event.target.value)} value={task.status}>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </label>
                    )}
                  </td>
                  <td className="menu-cell">
                    {task.canManage && <button className="icon-button row-menu-button" onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)} aria-label={`Actions for ${task.title}`} type="button"><Icon name="more" size={18} /></button>}
                    {task.canManage && openMenuId === task.id && (
                      <div className="row-menu">
                        <button onClick={() => onEdit(task)} type="button">Edit task</button>
                        <button onClick={() => onDelete(task)} type="button">Delete task</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </AnimatedList>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No tasks found"
          description={search ? 'Try another search or clear the search field.' : onCreate ? 'Create a task to get your workspace moving.' : 'No tasks are currently assigned to this project.'}
          actionLabel={!search && onCreate ? 'Create a task' : undefined}
          onAction={onCreate}
        />
      )}
      {!isLoading && tasks.length > 0 && <div className="table-footer"><span>Showing {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span><span className="table-footer-dot" />Updated just now</div>}
    </section>
  )
}
