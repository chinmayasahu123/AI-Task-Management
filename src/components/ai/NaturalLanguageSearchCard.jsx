import { useState } from 'react'
import AnimatedList from '../AnimatedList'
import AIActionCard from './AIActionCard'
import useAiAction from './useAiAction'

export default function NaturalLanguageSearchCard({ isConfigured }) {
  const action = useAiAction()
  const [query, setQuery] = useState('')

  return (
    <AIActionCard
      title="Ask about your tasks"
      description="Search your accessible tasks with a natural-language question."
      buttonLabel="Search tasks"
      isRunning={action.isRunning}
      isDisabled={query.trim().length < 2 || !isConfigured}
      error={action.error}
      onRun={() => action.run('/api/ai/search', { query })}
    >
      <label className="ai-field"><span>Your question</span>
        <input maxLength={500} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && query.trim().length >= 2 && isConfigured && !action.isRunning) action.run('/api/ai/search', { query })
        }} placeholder="Which tasks are due this week?" value={query} />
      </label>
      {action.result && (
        <div className="ai-search-result">
          <p>{action.result.answer || 'No matching tasks found.'}</p>
          {action.result.tasks.length > 0 && <AnimatedList as="ul" className="ai-search-tasks" stagger={0.04}>{action.result.tasks.map((task) => <li key={task.id}><strong>{task.title}</strong><span>{task.project} · {task.status.replace('_', ' ')} · Due {task.dueDate}</span></li>)}</AnimatedList>}
          {action.result.truncated && <span>Search used the first 100 accessible tasks.</span>}
        </div>
      )}
    </AIActionCard>
  )
}
