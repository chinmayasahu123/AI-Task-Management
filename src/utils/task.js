export function getTaskStatus(task, today = new Date().toISOString().slice(0, 10)) {
  if (task.status === 'completed') return 'completed'
  if (task.dueDate < today) return 'overdue'
  return task.status
}
