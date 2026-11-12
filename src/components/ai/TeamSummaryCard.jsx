import { useState } from 'react'
import AnimatedList from '../AnimatedList'
import AIActionCard from './AIActionCard'
import useAiAction from './useAiAction'

export default function TeamSummaryCard({ teams, isConfigured }) {
  const action = useAiAction()
  const [teamId, setTeamId] = useState('')

  return (
    <AIActionCard
      title="Team progress summary"
      description="Summarize member progress for a team you belong to."
      buttonLabel="Summarize team"
      isRunning={action.isRunning}
      isDisabled={!teamId || !isConfigured}
      error={action.error}
      onRun={() => action.run('/api/ai/team-summary', { teamId })}
    >
      <label className="ai-field"><span>Choose a team</span>
        <select onChange={(event) => setTeamId(event.target.value)} value={teamId}>
          <option value="">Select a team</option>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>
      {action.result && (
        <div className="ai-summary-result">
          <p>{action.result.summary}</p>
          {action.result.highlights.length > 0 && <AnimatedList as="ul" className="ai-summary-highlights" stagger={0.04}>{action.result.highlights.map((highlight, index) => <li key={`${index}-${highlight}`}>{highlight}</li>)}</AnimatedList>}
          {action.result.truncated && <span>Summary used a limited set of team progress records.</span>}
        </div>
      )}
    </AIActionCard>
  )
}
