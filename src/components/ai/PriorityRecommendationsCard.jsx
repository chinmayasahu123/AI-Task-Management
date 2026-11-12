import AIActionCard from './AIActionCard'
import AIInsightResults from './AIInsightResults'
import useAiAction from './useAiAction'

export default function PriorityRecommendationsCard({ isConfigured }) {
  const action = useAiAction()
  return (
    <AIActionCard
      title="What should I work on?"
      description="Rank open tasks using their due dates, priority, and status."
      buttonLabel="Recommend priorities"
      isRunning={action.isRunning}
      isDisabled={!isConfigured}
      error={action.error}
      onRun={() => action.run('/api/ai/priorities', {})}
    >
      {action.result && (
        <>
          <AIInsightResults items={action.result.recommendations} />
          {action.result.truncated && <p className="ai-limit-note">Analysis used the first 100 accessible tasks.</p>}
        </>
      )}
    </AIActionCard>
  )
}
