import StatCard from './StatCard'

export default function SummaryCards({ counts, includeOverdue = false }) {
  return (
    <section className="stats-grid" aria-label="Task summary">
      <StatCard label="Total tasks" value={counts.total} note="Across all projects" icon="check" tone="blue" />
      <StatCard label="Completed" value={counts.completed} note={`${counts.total ? Math.round((counts.completed / counts.total) * 100) : 0}% of total`} icon="check" tone="green" />
      <StatCard
        label={includeOverdue ? 'Overdue' : 'In progress'}
        value={includeOverdue ? counts.overdue : counts.in_progress}
        note={includeOverdue ? 'Needs your attention' : `${counts.total ? Math.round((counts.in_progress / counts.total) * 100) : 0}% of total`}
        icon={includeOverdue ? 'flag' : 'spark'}
        tone="orange"
      />
    </section>
  )
}
