import { useState } from 'react'
import AIActionCard from './AIActionCard'
import useAiAction from './useAiAction'

export default function GeneralQuestionCard({ isConfigured }) {
  const action = useAiAction()
  const [question, setQuestion] = useState('')

  return (
    <AIActionCard
      title="Ask anything"
      description="Get a direct answer to general questions, not just task-related prompts."
      buttonLabel="Ask AI"
      isRunning={action.isRunning}
      isDisabled={question.trim().length < 2 || !isConfigured}
      error={action.error}
      onRun={() => action.run('/api/ai/ask', { question })}
    >
      <label className="ai-field"><span>Your question</span>
        <textarea
          rows={4}
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask anything"
          value={question}
        />
      </label>
      {action.result && (
        <div className="ai-search-result">
          <p>{action.result.answer}</p>
        </div>
      )}
    </AIActionCard>
  )
}
