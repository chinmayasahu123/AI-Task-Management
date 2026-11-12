import Avatar from './Avatar'
import AnimatedList from './AnimatedList'
import EmptyState from './EmptyState'
import LoadingState from './LoadingState'
import PanelHeading from './PanelHeading'
import PriorityBadge from './PriorityBadge'
import { formatDate } from '../utils/date'

export default function UpcomingTasks({ tasks, isLoading, onEdit, onViewAll }) {
  return (
    <div className="panel upcoming-panel">
      <PanelHeading title="Upcoming tasks" eyebrow="COMING UP" actionLabel="View all" onAction={onViewAll} />
      {isLoading ? <LoadingState /> : tasks.length ? (
        <AnimatedList className="upcoming-list" stagger={0.06}>
          {tasks.map((task) => {
            const content = (
              <>
                <div className="date-tile"><span>{formatDate(task.dueDate, { month: 'short' }).toUpperCase()}</span><strong>{formatDate(task.dueDate, { day: 'numeric' })}</strong></div>
                <div className="upcoming-copy"><strong>{task.title}</strong><span>{task.project}</span></div>
                <PriorityBadge priority={task.priority} />
                {task.isTeamTask
                  ? <Avatar name={task.teamName} src={task.teamMembers.find((member) => member.isLead)?.avatarUrl} />
                  : <Avatar name={task.assignee} src={task.assigneeAvatarUrl} />}
              </>
            )
            return task.canManage
              ? <button className="upcoming-row" key={task.id} onClick={() => onEdit(task)} type="button">{content}</button>
              : <div className="upcoming-row" key={task.id}>{content}</div>
          })}
        </AnimatedList>
      ) : <EmptyState title="Nothing due soon" description="Your upcoming tasks will show here." />}
    </div>
  )
}
