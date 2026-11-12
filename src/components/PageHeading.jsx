import Icon from './Icon'
import { pageLabels } from '../constants/navigation'

const subtitles = {
  overview: 'Here’s what’s happening with your team today.',
  priority: 'Keep an eye on the work that needs attention first.',
  calendar: 'See every task on its due date and track its status at a glance.',
  ai: 'Get thoughtful suggestions based on the work you can access.',
}

export default function PageHeading({ activePage, user, onCreate, onCreateNote, onCreateTeam }) {
  const title = pageLabels[activePage]
  const heading = activePage === 'overview' && user?.name
    ? `Hi, ${user.name} 👋`
    : activePage === 'overview' ? 'Tasks overview' : title

  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1>{heading}</h1>
        <p className="page-subtitle">{subtitles[activePage] || `Keep your ${title.toLowerCase()} organized and moving forward.`}</p>
      </div>
      <div className="page-heading-actions">
        {activePage === 'team' && <button className="secondary-button" onClick={onCreateTeam} type="button"><Icon name="plus" size={18} /> New team</button>}
        {activePage === 'notes'
          ? <button className="primary-button" onClick={onCreateNote} type="button"><Icon name="plus" size={18} /> New note</button>
          : ['overview', 'tasks', 'priority'].includes(activePage) && <button className="primary-button" onClick={onCreate} type="button"><Icon name="plus" size={18} /> New task</button>}
      </div>
    </div>
  )
}
