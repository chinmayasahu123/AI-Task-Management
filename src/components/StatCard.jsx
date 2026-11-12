import Icon from './Icon'

export default function StatCard({ label, value, note, icon, tone }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top"><span className="stat-icon"><Icon name={icon} size={18} /></span><span className="stat-label">{label}</span></div>
      <div className="stat-bottom"><div><strong>{value}</strong><span>{note}</span></div><div className="stat-ring" aria-hidden="true"><span /></div></div>
    </div>
  )
}
