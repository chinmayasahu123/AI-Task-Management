import AnimatedList from '../AnimatedList'

function TaskInsight({ task, label, reason }) {
  return (
    <li className="ai-insight-item">
      <div><strong>{task.title}</strong><span>{task.project} · Due {task.dueDate}</span></div>
      {label && <span className={`ai-risk-tag ${label}`}>{label} risk</span>}
      <p>{reason}</p>
    </li>
  )
}

export default function AIInsightResults({ items, labelFor }) {
  if (!items.length) return <p className="ai-empty-result">No tasks were flagged by this analysis.</p>
  return (
    <>
      <AnimatedList as="ul" className="ai-insight-list" stagger={0.04}>
        {items.map(({ task, reason, risk }, index) => (
          <TaskInsight
            key={`${task.id}-${index}`}
            task={task}
            label={labelFor ? labelFor(risk) : null}
            reason={reason}
          />
        ))}
      </AnimatedList>
    </>
  )
}
