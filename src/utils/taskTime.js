export function getElapsedSeconds(task, now = Date.now()) {
  const elapsedSeconds = Number(task.elapsedSeconds) || 0
  if (!task.timerRunning || !task.timerSnapshotAt) return elapsedSeconds
  return elapsedSeconds + Math.max(0, Math.floor((now - task.timerSnapshotAt) / 1000))
}

export function formatDuration(seconds) {
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}
