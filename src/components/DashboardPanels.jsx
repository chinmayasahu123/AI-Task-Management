import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar'
import Icon from './Icon'
import TaskStatusChart from './TaskStatusChart'
import { requestJson } from '../api/client'
import { formatDate } from '../utils/date'
import { getTaskStatus } from '../utils/task'

function ActivityChart({ activity }) {
  const [range, setRange] = useState('week')
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const days = useMemo(() => {
    const count = range === 'day' ? 1 : range === 'week' ? 7 : 30
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (count - index - 1))
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const row = activity.find((item) => item.date === key)
      return { date, value: (row?.created ?? 0) + (row?.completed ?? 0) }
    })
  }, [activity, range])
  const max = Math.max(1, ...days.map((day) => day.value))
  const pointData = days.map((day, index) => ({ ...day, x: days.length === 1 ? 50 : (index / (days.length - 1)) * 100, y: 94 - (day.value / max) * 76 }))
  const points = pointData.map((point) => `${point.x},${point.y}`).join(' ')
  return <section className="panel dash-panel activity-chart-panel"><div className="dash-panel-head"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Task activity</h2></div><div className="activity-range-tabs">{[['day','Day'],['week','Week'],['month','Month']].map(([id,label])=><button aria-pressed={range===id} className={range===id?'selected':''} key={id} onClick={()=>setRange(id)} type="button">{label}</button>)}</div></div><div className="activity-chart-total"><strong>{days.reduce((sum, day) => sum + day.value, 0)}</strong><span>task actions</span></div><div className="activity-chart-plot">{hoveredPoint&&<div className="activity-hover-info"><span className="activity-hover-dot"/>{formatDate(hoveredPoint.date.toISOString().slice(0,10))}<strong>{hoveredPoint.value}</strong><span>{hoveredPoint.value===1?'task action':'task actions'}</span></div>}<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${range} task activity trend`} onMouseLeave={()=>setHoveredPoint(null)}><defs><linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6694f2" stopOpacity=".30"/><stop offset="100%" stopColor="#6694f2" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${points} 100,100`} fill="url(#activityFill)"/><polyline points={points} fill="none" stroke="#5c88e8" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>{pointData.map((point)=><circle key={point.date.toISOString()} cx={point.x} cy={point.y} r="5" fill="transparent" onMouseEnter={()=>setHoveredPoint(point)} onFocus={()=>setHoveredPoint(point)} onBlur={()=>setHoveredPoint(null)} tabIndex={0}/>)}</svg></div><div className="activity-chart-labels"><span>{range==='day'?'Today':range==='week'?'7 days ago':'30 days ago'}</span><span>Today</span></div></section>
}

export default function DashboardPanels({ tasks, user, counts, isLoading, onEdit, onNavigate, activityPage = false }) {
  const [activity, setActivity] = useState([])
  const [eventRows, setEventRows] = useState([])
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  useEffect(() => { let active = true; requestJson('/api/tasks/activity?days=31').then((result) => { if(active) setActivity(result.activity) }).catch(() => {}); return () => { active = false } }, [])
  useEffect(() => { if(!activityPage)return undefined;let active=true;requestJson('/api/activity').then(result=>{if(active)setEventRows(result.activity)}).catch(()=>{});return()=>{active=false} }, [activityPage])
  useEffect(() => { if (!timerRunning) return undefined; const id = window.setInterval(() => setTimerSeconds((value) => value + 1), 1000); return () => window.clearInterval(id) }, [timerRunning])
  const todos = tasks.filter((task) => getTaskStatus(task, today) !== 'completed').sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0,5)
  const weekly = Array.from({length:7},(_,i)=>{ const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(6-i)); const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; return {date, count:activity.find(x=>x.date===key)?.completed??0} })
  const maxWeekly=Math.max(1,...weekly.map(x=>x.count))
  const memberStats = new Map()
  for (const task of tasks.filter((item)=>getTaskStatus(item,today)==='completed')) { const person=task.isTeamTask ? task.teamMembers?.find((member)=>member.status==='completed') : {id:task.assigneeId,name:task.assignee,avatarUrl:task.assigneeAvatarUrl}; if(person?.name){const key=String(person.id??person.name);const previous=memberStats.get(key)??{...person,completed:0};previous.completed++;memberStats.set(key,previous)} }
  const leaders=[...memberStats.values()].sort((a,b)=>b.completed-a.completed).slice(0,4)
  const recent=[...tasks].sort((a,b)=>new Date(b.updatedAt??b.createdAt)-new Date(a.updatedAt??a.createdAt)).slice(0,5)
  const taskActivity=(task)=>task.status==='completed'?'completed':task.status==='in_progress'?'is in progress':'was added'
  const clock=`${String(Math.floor(timerSeconds/60)).padStart(2,'0')}:${String(timerSeconds%60).padStart(2,'0')}`
  return <div className={activityPage?'activity-page-layout':'dashboard-widgets'}>
    {!activityPage&&<>
      <div className="dashboard-status"><TaskStatusChart counts={counts} isLoading={isLoading}/></div>
      <section className="panel dash-panel todo-panel"><div className="dash-panel-head"><div><p className="eyebrow">NEXT UP</p><h2>To-do list</h2></div><button className="text-button" onClick={()=>onNavigate('tasks')} type="button">All tasks <Icon name="arrow" size={14}/></button></div>{todos.length?<div className="dash-todo-list">{todos.map(task=><button className="dash-todo-row" key={task.id} onClick={()=>onEdit(task)} type="button"><span className="dash-todo-check"/><span className="dash-todo-copy"><strong>{task.title}</strong><small>{task.project} · {task.dueDate?`Due ${formatDate(task.dueDate)}`:'No deadline'}</small></span><span className={`dash-todo-priority ${task.priority}`}>{task.priority}</span></button>)}</div>:<p className="dash-empty">You’re all caught up.</p>}</section>
      <ActivityChart activity={activity}/>
      <section className="panel dash-panel weekly-panel"><div className="dash-panel-head"><div><p className="eyebrow">LAST 7 DAYS</p><h2>Weekly completions</h2></div><span className="weekly-total">{weekly.reduce((sum,day)=>sum+day.count,0)} done</span></div><div className="weekly-bars">{weekly.map((day)=><div className="weekly-bar-column" key={day.date.toISOString()} title={`${day.count} completed`}><div className="weekly-bar-track"><span style={{height:`${Math.max(day.count?8:0,(day.count/maxWeekly)*100)}%`}}/></div><small>{new Intl.DateTimeFormat(undefined,{weekday:'narrow'}).format(day.date)}</small></div>)}</div></section>
      <section className="panel dash-panel leaders-panel"><div className="dash-panel-head"><div><p className="eyebrow">TEAM MOMENTUM</p><h2>Top team members</h2></div></div>{leaders.length?<div className="leader-list">{leaders.map((member,index)=><div className="leader-row" key={member.id}><span className="leader-rank">{index+1}</span><Avatar name={member.name} src={member.avatarUrl}/><strong>{member.name}{String(member.id)===String(user.id)?' (you)':''}</strong><span>{member.completed} done</span></div>)}</div>:<p className="dash-empty">Completions will appear here as tasks are finished.</p>}</section>
      <section className="panel dash-panel timer-panel"><div><p className="eyebrow">FOCUS SESSION</p><h2>Stopwatch</h2></div><div className="stopwatch-face"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" style={{strokeDashoffset:327-(timerSeconds%60)/60*327}}/></svg><div className="stopwatch-reading"><strong>{clock}</strong><span>{timerRunning?'Counting up':timerSeconds?'Paused':'Ready'}</span></div></div><div className="focus-controls"><button className="primary-button" onClick={()=>setTimerRunning(!timerRunning)} type="button">{timerRunning?'Pause':timerSeconds?'Resume':'Start'}</button><button className="secondary-button" onClick={()=>{setTimerRunning(false);setTimerSeconds(0)}} type="button">Reset</button></div></section>
      <section className="panel dash-panel recent-panel"><div className="dash-panel-head"><div><p className="eyebrow">LATEST UPDATES</p><h2>Recent activity</h2></div><button className="text-button" onClick={()=>onNavigate('activity')} type="button">See all <Icon name="arrow" size={14}/></button></div>{recent.map(task=><div className="recent-row" key={task.id}><span className="recent-dot"/><span><strong>{task.title}</strong><small>{task.assignee===user.name?'You':task.assignee} {taskActivity(task)} · {task.project}</small></span><time>{formatDate((task.updatedAt??task.createdAt??today).slice(0,10))}</time></div>)}</section>
    </>}
    {activityPage&&<><div className="activity-page-heading"><p className="eyebrow">WORKSPACE TIMELINE</p><h2>Recent activity</h2><p>Latest task updates across your workspace.</p></div><section className="panel dash-panel activity-full-list">{eventRows.length?eventRows.map(item=><div className="recent-row" key={item.id}><span className="recent-dot"/><span><strong>{item.actorName} {item.summary}</strong><small>{item.type.replaceAll('_',' ')}{item.teamId?` · Team ${item.teamId}`:''}</small></span><time>{formatDate(String(item.createdAt).slice(0,10))}</time></div>):<p className="dash-empty">No activity has been recorded yet.</p>}</section><ActivityChart activity={activity}/></>}
  </div>
}
