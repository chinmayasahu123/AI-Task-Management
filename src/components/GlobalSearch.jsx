import { useEffect, useMemo, useRef, useState } from 'react'
import AnimatedList from './AnimatedList'
import Icon from './Icon'

const maxResults = 8

function matches(values, query) {
  return values.some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
}

function buildResults(query, tasks, teams) {
  if (query.length < 2) return []

  const results = []
  for (const task of tasks) {
    if (matches([
      task.title,
      task.project,
      task.assignee,
      task.teamName,
      task.priority,
      task.status,
      ...(task.teamMembers ?? []).map((member) => member.name),
    ], query)) {
      results.push({
        id: `task-${task.id}`,
        type: 'Task',
        label: task.title,
        detail: [task.project, task.teamName].filter(Boolean).join(' · ') || task.status.replace('_', ' '),
        page: 'tasks',
        searchTerm: task.title,
      })
    }
  }

  const matchingProjects = new Set()
  for (const task of tasks) {
    if (matches([task.project], query) && !matchingProjects.has(task.project)) {
      matchingProjects.add(task.project)
      results.push({
        id: `project-${task.project}`,
        type: 'Project',
        label: task.project,
        detail: 'Open project tasks',
        page: 'projects',
        searchTerm: task.project,
      })
    }
  }

  for (const team of teams) {
    if (matches([team.name], query)) {
      results.push({
        id: `team-${team.id}`,
        type: 'Team',
        label: team.name,
        detail: `${team.members.length} ${team.members.length === 1 ? 'member' : 'members'}`,
        page: 'team',
        searchTerm: team.name,
      })
    }
    for (const member of team.members) {
      if (matches([member.name], query)) {
        results.push({
          id: `member-${team.id}-${member.id}`,
          type: 'Member',
          label: member.name,
          detail: `Member of ${team.name}`,
          page: 'team',
          searchTerm: member.name,
        })
      }
    }
  }

  return results.slice(0, maxResults)
}

export default function GlobalSearch({ tasks, teams, onSelectResult }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchRef = useRef(null)
  const results = useMemo(
    () => buildResults(query.trim().toLocaleLowerCase(), tasks, teams),
    [query, tasks, teams],
  )

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!searchRef.current?.contains(event.target)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [])

  function chooseResult(result) {
    onSelectResult(result)
    setQuery('')
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    } else if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault()
      chooseResult(results[activeIndex])
    }
  }

  return (
    <div className="global-search" ref={searchRef}>
      <Icon name="search" size={17} />
      <input
        aria-activedescendant={activeIndex >= 0 ? `global-search-result-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls="global-search-results"
        aria-expanded={isOpen && query.trim().length >= 2}
        aria-label="Search tasks, projects, teams, and members"
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(-1)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search tasks, teams..."
        role="combobox"
        value={query}
      />
      {query && (
        <button
          aria-label="Clear search"
          className="global-search-clear"
          onClick={() => {
            setQuery('')
            setActiveIndex(-1)
            setIsOpen(true)
          }}
          type="button"
        >
          <Icon name="close" size={15} />
        </button>
      )}
      {isOpen && query.trim().length >= 2 && (
        <AnimatedList className="global-search-results" id="global-search-results" role="listbox" stagger={0.025}>
          {results.length ? results.map((result, index) => (
            <button
              aria-selected={activeIndex === index}
              className="global-search-result"
              id={`global-search-result-${index}`}
              key={result.id}
              onClick={() => chooseResult(result)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              <span className="global-search-result-icon"><Icon name={result.type === 'Team' || result.type === 'Member' ? 'users' : result.type === 'Project' ? 'folder' : 'check'} size={15} /></span>
              <span className="global-search-result-copy"><strong>{result.label}</strong><span>{result.detail}</span></span>
              <span className="global-search-result-type">{result.type}</span>
            </button>
          )) : (
            <p className="global-search-empty">No matching tasks, projects, teams, or members.</p>
          )}
        </AnimatedList>
      )}
    </div>
  )
}
