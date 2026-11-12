import { useMemo, useState } from 'react'
import Icon from './Icon'
import { getTaskStatus } from '../utils/task'
import './CalendarPage.css'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const taskStatusLabel = (status) => ({ in_progress: 'In progress', pending: 'To do', completed: 'Completed', overdue: 'Overdue' })[status] ?? status

function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export default function CalendarPage({ tasks, isLoading, search, onSearch, onEdit }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const today = toDateKey(new Date())
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)
  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks.filter((task) => !query || [task.title, task.project, task.status, task.assignee, task.teamName ?? '']
      .some((value) => String(value ?? '').toLowerCase().includes(query)))
  }, [search, tasks])
  const tasksByDate = useMemo(() => {
    const grouped = new Map()
    for (const task of visibleTasks) {
      if (!task.dueDate) continue
      const group = grouped.get(task.dueDate) ?? []
      group.push(task)
      grouped.set(task.dueDate, group)
    }
    for (const group of grouped.values()) group.sort((a, b) => a.title.localeCompare(b.title))
    return grouped
  }, [visibleTasks])
  const dates = useMemo(() => {
    const offset = (month.getDay() + 6) % 7
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const cellCount = Math.max(35, Math.ceil((offset + dayCount) / 7) * 7)
    return Array.from({ length: cellCount }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1))
  }, [month])
  const selectedTasks = tasksByDate.get(selectedDate) ?? []
  const monthTaskCount = dates
    .filter((date) => date.getMonth() === month.getMonth())
    .reduce((total, date) => total + (tasksByDate.get(toDateKey(date))?.length ?? 0), 0)
  const selectedLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${selectedDate}T12:00:00`))

  function changeMonth(amount) {
    const nextMonth = shiftMonth(month, amount)
    setMonth(nextMonth)
    setSelectedDate(toDateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)))
  }

  function goToToday() {
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(toDateKey(now))
  }

  return (
    <section className="calendar-page" aria-label="Task calendar">
      <div className="calendar-toolbar">
        <div className="calendar-month-heading">
          <span className="calendar-heading-icon"><Icon name="calendar" size={18} /></span>
          <div><h2>{monthLabel}</h2><p>{monthTaskCount} {monthTaskCount === 1 ? 'task' : 'tasks'} this month</p></div>
        </div>
        <div className="calendar-actions">
          <label className="calendar-search"><Icon name="search" size={15} /><input aria-label="Search calendar tasks" onChange={(event) => onSearch(event.target.value)} placeholder="Find a task" value={search} /></label>
          <div className="calendar-month-nav" aria-label="Calendar month navigation">
            <button aria-label="Previous month" onClick={() => changeMonth(-1)} type="button">‹</button>
            <button className="calendar-today" onClick={goToToday} type="button">Today</button>
            <button aria-label="Next month" onClick={() => changeMonth(1)} type="button">›</button>
          </div>
        </div>
      </div>

      <div className="calendar-surface">
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        {isLoading ? <div className="calendar-loading">Loading your schedule…</div> : (
          <div className="calendar-grid">
            {dates.map((date) => {
              const dateKey = toDateKey(date)
              const dayTasks = tasksByDate.get(dateKey) ?? []
              const inMonth = date.getMonth() === month.getMonth()
              const selected = dateKey === selectedDate
              return (
                <div
                  className={`calendar-day${inMonth ? '' : ' is-outside'}${selected ? ' is-selected' : ''}${dateKey === today ? ' is-today' : ''}`}
                  key={dateKey}
                >
                  <button aria-pressed={selected} className="calendar-day-number" onClick={() => setSelectedDate(dateKey)} type="button">{date.getDate()}</button>
                  {dayTasks.slice(0, 3).map((task) => {
                    const status = getTaskStatus(task, today)
                    return <button className={`calendar-task-chip status-${status}`} key={task.id} onClick={() => onEdit(task)} title={`${task.title} · ${taskStatusLabel(status)}`} type="button">
                      <span className="calendar-task-title">{task.title}</span><span className="calendar-task-status">{taskStatusLabel(status)}</span>
                    </button>
                  })}
                  {dayTasks.length > 3 && <span className="calendar-more">+{dayTasks.length - 3} more</span>}
                  {dayTasks.length === 0 && inMonth && <span className="calendar-day-empty">No tasks</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <section className="calendar-agenda" aria-live="polite">
        <div className="calendar-agenda-heading"><div><p>DAY AGENDA</p><h3>{selectedLabel}</h3></div><span>{selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'}</span></div>
        {selectedTasks.length === 0 ? <p className="calendar-agenda-empty">Nothing scheduled for this day.</p> : (
          <div className="calendar-agenda-list">
            {selectedTasks.map((task) => {
              const status = getTaskStatus(task, today)
              return <button className="calendar-agenda-task" key={task.id} onClick={() => onEdit(task)} type="button">
                <span className={`calendar-status-dot status-${status}`} />
                <span className="calendar-agenda-copy"><strong>{task.title}</strong><small>{task.project}{task.assignee ? ` · ${task.assignee}` : ''}</small></span>
                <span className={`calendar-agenda-status status-${status}`}>{taskStatusLabel(status)}</span>
              </button>
            })}
          </div>
        )}
      </section>
    </section>
  )
}
