import AIActionCard from './AIActionCard'
import AIInsightResults from './AIInsightResults'
import useAiAction from './useAiAction'

export default function DeadlineRiskCard({ isConfigured }) {
  const action = useAiAction()
  return (
    <AIActionCard
      title="Deadline risk check"
      description="Flag open tasks that may need attention before their due date."
      buttonLabel="Check deadline risks"
      isRunning={action.isRunning}
      isDisabled={!isConfigured}
      error={action.error}
      onRun={() => action.run('/api/ai/deadline-risks', {})}
    >
      {action.result && (
        <>
          <AIInsightResults items={action.result.risks} labelFor={(risk) => risk} />
          {action.result.truncated && <p className="ai-limit-note">Analysis used the first 100 accessible tasks.</p>}
          <p className="ai-context">Risk scores are AI estimates. Review the task details before changing plans.</p>
        </>
      )}
    </AIActionCard>
  )
}
