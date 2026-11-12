import { useState } from 'react'
import PanelHeading from './PanelHeading'
import LoadingState from './LoadingState'

const statusSegments = [
  { key: 'completed', label: 'Completed', color: '#17a16a', legendColor: 'green' },
  { key: 'in_progress', label: 'In progress', color: '#367be5', legendColor: 'blue' },
  { key: 'pending', label: 'Pending', color: '#e8912f', legendColor: 'orange' },
  { key: 'overdue', label: 'Overdue', color: '#df5c5c', legendColor: 'red' },
]

const chartRadius = 56
const chartCircumference = 2 * Math.PI * chartRadius

function LegendItem({ label, count, color, total }) {
  return (
    <div className="legend-item">
      <span className={`legend-dot ${color}`} />
      <span>{label}</span>
      <strong>{count}</strong>
      <span className="legend-percent">{total ? Math.round((count / total) * 100) : 0}%</span>
    </div>
  )
}

export default function TaskStatusChart({ counts, isLoading }) {
  const [activeStatus, setActiveStatus] = useState(null)

  return (
    <div className="panel status-panel">
      <PanelHeading title="Tasks by status" eyebrow="AT A GLANCE" />
      {isLoading ? <LoadingState /> : (
        <div className="status-content">
          <div
            className="donut-chart"
            aria-label={`Task status chart, ${counts.total} total tasks`}
          >
            <svg className="donut-ring" viewBox="0 0 140 140" aria-label="Task status segments">
              <circle
                className="donut-track"
                cx="70"
                cy="70"
                r={chartRadius}
                fill="none"
                strokeWidth="22"
              />
              {statusSegments.map((segment, index) => {
                const count = counts[segment.key]
                const length = counts.total ? (count / counts.total) * chartCircumference : 0
                const offset = statusSegments.slice(0, index).reduce(
                  (totalLength, previous) => totalLength + (counts.total ? (counts[previous.key] / counts.total) * chartCircumference : 0),
                  0,
                )
                if (!length) return null
                return (
                  <circle
                    key={segment.key}
                    className="donut-segment"
                    cx="70"
                    cy="70"
                    r={chartRadius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="22"
                    strokeDasharray={`${length} ${chartCircumference - length}`}
                    strokeDashoffset={-offset}
                    aria-label={`${segment.label}: ${count} ${count === 1 ? 'task' : 'tasks'}`}
                    onBlur={() => setActiveStatus(null)}
                    onFocus={() => setActiveStatus({ ...segment, count })}
                    onMouseEnter={() => setActiveStatus({ ...segment, count })}
                    onMouseLeave={() => setActiveStatus(null)}
                    role="graphics-symbol"
                    tabIndex={0}
                  />
                )
              })}
            </svg>
            <div className="donut-chart-hole" />
            <div className="donut-center"><strong>{counts.total}</strong><span>Total tasks</span></div>
            {activeStatus && (
              <div className="donut-tooltip" role="status">
                <span className={`legend-dot ${activeStatus.legendColor}`} />
                <span>{activeStatus.label}</span>
                <strong>{activeStatus.count}</strong>
                <span>{activeStatus.count === 1 ? 'task' : 'tasks'}</span>
              </div>
            )}
          </div>
          <div className="legend">
            <LegendItem label="Completed" count={counts.completed} color="green" total={counts.total} />
            <LegendItem label="In progress" count={counts.in_progress} color="blue" total={counts.total} />
            <LegendItem label="Pending" count={counts.pending} color="orange" total={counts.total} />
            <LegendItem label="Overdue" count={counts.overdue} color="red" total={counts.total} />
          </div>
        </div>
      )}
    </div>
  )
}
