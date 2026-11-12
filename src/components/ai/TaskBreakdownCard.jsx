import { useState } from 'react'
import AnimatedList from '../AnimatedList'
import AIActionCard from './AIActionCard'
import useAiAction from './useAiAction'

export default function TaskBreakdownCard({ tasks, isConfigured }) {
  const action = useAiAction()
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const selectedTask = tasks.find((task) => String(task.id) === selectedTaskId)

  return (
    <AIActionCard
      title="Break down a task"
      description="Turn an existing task into a practical checklist."
      buttonLabel="Suggest subtasks"
      isRunning={action.isRunning}
      isDisabled={!selectedTaskId || !isConfigured}
      error={action.error}
      onRun={() => action.run('/api/ai/task-breakdown', { taskId: selectedTaskId })}
    >
      <label className="ai-field"><span>Choose a task</span>
        <select onChange={(event) => setSelectedTaskId(event.target.value)} value={selectedTaskId}>
          <option value="">Select a task</option>
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
      </label>
      {selectedTask && <p className="ai-context">{selectedTask.project}{selectedTask.teamName ? ` · ${selectedTask.teamName}` : ''}</p>}
      {action.result && (
        <AnimatedList as="ol" className="ai-result-list" stagger={0.04}>
          {action.result.subtasks.map((subtask, index) => <li key={`${index}-${subtask}`}>{subtask}</li>)}
        </AnimatedList>
      )}
    </AIActionCard>
  )
}
