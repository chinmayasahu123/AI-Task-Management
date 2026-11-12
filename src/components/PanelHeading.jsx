import Icon from './Icon'

export default function PanelHeading({ title, eyebrow, actionLabel, onAction }) {
  return (
    <div className="panel-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      {actionLabel && <button className="text-button" onClick={onAction} type="button">{actionLabel}<Icon name="arrow" size={14} /></button>}
    </div>
  )
}
