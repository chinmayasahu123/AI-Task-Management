import { useEffect, useMemo, useState } from 'react'
import { requestJson } from '../api/client'
import './TaskActivityHeatmap.css'

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const monthLabel = (date) => new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)

function activityLevel(total) {
  if (!total) return 0
  if (total === 1) return 1
  if (total <= 3) return 2
  if (total <= 6) return 3
  return 4
}

export default function TaskActivityHeatmap() {
  const [activity, setActivity] = useState([])
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    requestJson(`/api/tasks/activity?year=${selectedYear}`)
      .then((result) => { if (active) setActivity(result.activity) })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [selectedYear])

  const activityMap = useMemo(() => new Map(activity.map((day) => [day.date, day])), [activity])
  const days = useMemo(() => {
    const first = new Date(selectedYear, 0, 1, 12)
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7))
    const last = new Date(selectedYear, 11, 31, 12)
    last.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)))
    const result = []
    for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
      const day = activityMap.get(dateKey(cursor))
      result.push({
        date: new Date(cursor),
        created: day?.created ?? 0,
        completed: day?.completed ?? 0,
      })
    }
    return result
  }, [activityMap, selectedYear])
  const weeks = useMemo(() => Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7)), [days])
  const monthLabels = weeks.map((week, index) => {
    const firstDate = week.find((day) => day.date.getDate() === 1)
    return firstDate ? <span key={index} style={{ gridColumn: index + 1 }}>{monthLabel(firstDate.date)}</span> : null
  }).filter(Boolean)
  const totals = activity.reduce((sum, day) => ({ created: sum.created + day.created, completed: sum.completed + day.completed }), { created: 0, completed: 0 })
  const activeDays = activity.filter((day) => day.created + day.completed > 0).length

  return (
    <section className="panel activity-heatmap-panel">
      <div className="activity-heatmap-heading"><div><p className="eyebrow">CONSISTENCY OVER TIME</p><h2>Your daily task activity</h2><p>Tasks you created and completed in {selectedYear}. Each square shows your own activity.</p></div><div className="activity-heatmap-controls"><label><span className="sr-only">Choose activity year</span><select aria-label="Choose activity year" className="activity-year-select" onChange={(event) => setSelectedYear(Number(event.target.value))} value={selectedYear}>{Array.from({ length: Math.max(1, new Date().getFullYear() - 2021) }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label><span className="activity-days-count">{activeDays} active days</span></div></div>
      <div className="activity-totals"><div><span className="activity-mark created" /><strong>{totals.created}</strong><span>created</span></div><div><span className="activity-mark completed" /><strong>{totals.completed}</strong><span>completed</span></div></div>
      {error ? <p className="activity-heatmap-error" role="alert">{error}</p> : isLoading ? <div className="activity-heatmap-loading">Loading activity…</div> : (
        <div className="activity-heatmap-scroll" aria-label="Daily task activity calendar">
          <div className="activity-month-labels">{monthLabels}</div>
          <div className="activity-heatmap-body"><div className="activity-weekday-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div><div className="activity-weeks">{weeks.map((week, weekIndex) => <div className="activity-week" key={weekIndex}>{week.map((day) => {
            const key = dateKey(day.date)
            const total = day.created + day.completed
            const label = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(day.date)
            return <span aria-label={`${label}: ${day.created} created, ${day.completed} completed`} className={`activity-day level-${activityLevel(total)}`} key={key} title={`${label}: ${day.created} created, ${day.completed} completed`} />
          })}</div>)}</div></div>
          <div className="activity-heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i className={`activity-day level-${level}`} key={level} />)}<span>More</span></div>
        </div>
      )}
      <p className="activity-heatmap-note">Each square counts tasks created or completed on that day. Darker squares mean more activity.</p>
    </section>
  )
}
