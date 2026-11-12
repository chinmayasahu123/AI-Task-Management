import AnimatedList from './AnimatedList'
import PanelHeading from './PanelHeading'
import TaskActivityHeatmap from './TaskActivityHeatmap'
import { useMemo, useState } from 'react'
import { getTaskStatus } from '../utils/task'

export default function TaskReport({ tasks = [] }) {
  const [fromDate,setFromDate]=useState('')
  const [toDate,setToDate]=useState('')
  const filteredTasks=useMemo(()=>tasks.filter(task=>(!fromDate||task.dueDate>=fromDate)&&(!toDate||task.dueDate<=toDate)),[tasks,fromDate,toDate])
  const reportCounts=filteredTasks.reduce((result,task)=>{result.total++;result[getTaskStatus(task)]++;return result},{total:0,completed:0,in_progress:0,pending:0,overdue:0})
  function exportCsv(){
    const rows=[['Task','Project','Assignee','Priority','Status','Due date'],...filteredTasks.map(task=>[task.title,task.project,task.assignee,task.priority,task.status,task.dueDate])]
    const csv=rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='tracklap-task-report.csv';link.click();URL.revokeObjectURL(url)
  }
  const rows = [
    ['Completed', reportCounts.completed, 'green'],
    ['In progress', reportCounts.in_progress, 'blue'],
    ['Pending', reportCounts.pending, 'orange'],
    ['Overdue', reportCounts.overdue, 'red'],
  ]

  return (
    <div className="task-report-layout">
    <section aria-label="Task report filters and export" className="panel report-export-panel"><div><p className="eyebrow">EXPORT</p><h2>Task report</h2></div><label>Due from<input onChange={e=>setFromDate(e.target.value)} type="date" value={fromDate}/></label><label>Due to<input onChange={e=>setToDate(e.target.value)} type="date" value={toDate}/></label><button className="secondary-button" onClick={exportCsv} type="button">Export {filteredTasks.length} tasks as CSV</button></section>
    <TaskActivityHeatmap />
    <div className="panel report-panel task-status-report">
      <PanelHeading title="Task status report" eyebrow="WORK SUMMARY" />
      <AnimatedList className="report-donut-grid" stagger={0.06}>
        {rows.map(([label, count, color]) => {
          const percentage = reportCounts.total ? Math.round((count / reportCounts.total) * 100) : 0
          const detail = `${label}: ${count} of ${reportCounts.total} tasks (${percentage}%).`
          return <div className={`report-donut-card ${color}`} key={label} tabIndex={0} aria-label={detail}>
            <div className="report-donut" style={{ '--report-percent': `${percentage}%` }} aria-label={detail}>
              <div className="report-donut-center"><strong>{percentage}%</strong><span>{count} {count === 1 ? 'task' : 'tasks'}</span></div>
            </div>
            <strong className="report-donut-label">{label}</strong>
            <span className="report-donut-tooltip" role="tooltip"><i />{label}: <strong>{count}</strong> {count === 1 ? 'task' : 'tasks'} · {percentage}%</span>
          </div>
        })}
      </AnimatedList>
    </div>
    </div>
  )
}
