import { useEffect, useState } from 'react'
import { requestJson } from '../api/client'
import DeadlineRiskCard from './ai/DeadlineRiskCard'
import GeneralQuestionCard from './ai/GeneralQuestionCard'
import NaturalLanguageSearchCard from './ai/NaturalLanguageSearchCard'
import PriorityRecommendationsCard from './ai/PriorityRecommendationsCard'
import TaskBreakdownCard from './ai/TaskBreakdownCard'
import TeamSummaryCard from './ai/TeamSummaryCard'

export default function AIAssistantPage({ tasks, teams }) {
  const [aiConfigured, setAiConfigured] = useState(null)
  const [statusError, setStatusError] = useState('')

  useEffect(() => {
    let active = true
    requestJson('/api/ai/status')
      .then((status) => {
        if (active) setAiConfigured(status.configured)
      })
      .catch((error) => {
        if (active) setStatusError(error.message)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="ai-assistant-page">
      <section className="ai-intro panel">
        <div className="ai-intro-mark">✦</div>
        <div>
          <strong>AI suggestions, with you in control</strong>
          <p>AI uses only tasks and team information you can access. It suggests; it never changes tasks automatically.</p>
          {aiConfigured === false && <p className="ai-setup-note">To enable these features, add GEMINI_API_KEY to backend/.env and restart the API. Get a key from Google AI Studio.</p>}
          {statusError && <p className="ai-setup-note" role="alert">{statusError}</p>}
        </div>
      </section>
      <div className="ai-feature-grid">
        <div className="ai-feature-column">
        <TaskBreakdownCard tasks={tasks} isConfigured={aiConfigured === true} />
        <TeamSummaryCard teams={teams} isConfigured={aiConfigured === true} />
        <DeadlineRiskCard isConfigured={aiConfigured === true} />
        </div>
        <div className="ai-feature-column">
        <PriorityRecommendationsCard isConfigured={aiConfigured === true} />
        <NaturalLanguageSearchCard isConfigured={aiConfigured === true} />
        <GeneralQuestionCard isConfigured={aiConfigured === true} />
        </div>
      </div>
    </div>
  )
}
