export default function MiniStats({ counts }) {
  return (
    <section className="mini-stats">
      <div><span>All tasks</span><strong>{counts.total}</strong></div>
      <div><span>In progress</span><strong>{counts.in_progress}</strong></div>
      <div><span>Overdue</span><strong>{counts.overdue}</strong></div>
    </section>
  )
}
