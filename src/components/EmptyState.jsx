import Icon from './Icon'

export default function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name="check" size={20} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && <button className="text-button" onClick={onAction} type="button">{actionLabel}<Icon name="plus" size={15} /></button>}
    </div>
  )
}
