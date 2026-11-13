import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requestJson } from '../api/client'
import AIAssistantPage from '../components/AIAssistantPage'
import CalendarPage from '../components/CalendarPage'
import DashboardPanels from '../components/DashboardPanels'
import MiniStats from '../components/MiniStats'
import NotesPage from '../components/NotesPage'
import PageHeading from '../components/PageHeading'
import ProfilePhotoDialog from '../components/ProfilePhotoDialog'
import ProjectsPage from '../components/ProjectsPage'
import Sidebar from '../components/Sidebar'
import SettingsPage from '../components/SettingsPage'
import SummaryCards from '../components/SummaryCards'
import TaskModal from '../components/TaskModal'
import TaskReport from '../components/TaskReport'
import TaskTable from '../components/TaskTable'
import TeamManagementPanel from '../components/TeamManagementPanel'
import TeamModal from '../components/TeamModal'
import Topbar from '../components/Topbar'
import { pageLabels } from '../constants/navigation'
import { useAuth } from '../auth/useAuth'
import { getTaskStatus } from '../utils/task'
import { formatDuration, getElapsedSeconds } from '../utils/taskTime'

const MIN_SIDEBAR_WIDTH = 190
const MAX_SIDEBAR_WIDTH = 360
const DEFAULT_SIDEBAR_WIDTH = 244

async function fetchTasks() {
  const tasks = []
  let cursor = null
  do {
    const query = new URLSearchParams({ limit: '200' })
    if (cursor) query.set('cursor', cursor)
    const result = await requestJson(`/api/tasks?${query}`)
    tasks.push(...result.tasks)
    cursor = result.pagination?.nextCursor ?? null
  } while (cursor)
  return tasks
}

export default function WorkspacePage({ user, isDarkMode, onToggleTheme, onLogout, logoutError, activePage, onNavigate }) {
  const { updateProfilePicture, removeProfilePicture } = useAuth()
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem(`tracklap-sidebar-width-${user.id}`))
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, savedWidth))
    }
    return window.innerWidth <= 1100 ? 205 : DEFAULT_SIDEBAR_WIDTH
  })
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([user])
  const [teams, setTeams] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [timerNow, setTimerNow] = useState(0)
  const [overtimeWarnings, setOvertimeWarnings] = useState([])
  const overtimeNotified = useRef(new Set())
  const pageContentRef = useRef(null)
  const notesPageRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(`tracklap-sidebar-width-${user.id}`, String(sidebarWidth))
  }, [sidebarWidth, user.id])

  const resizeSidebar = useCallback((width) => {
    setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width)))
  }, [])

  const refreshTasks = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      setTasks(await fetchTasks())
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshUsers = useCallback(async () => {
    try {
      const result = await requestJson('/api/users/assignees')
      setUsers(result.users)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [])

  const refreshTeams = useCallback(async () => {
    try {
      const result = await requestJson('/api/teams')
      setTeams(result.teams)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.allSettled([fetchTasks(), requestJson('/api/users/assignees'), requestJson('/api/teams')])
      .then(([taskResult, userResult, teamResult]) => {
        if (!active) return
        if (taskResult.status === 'fulfilled') setTasks(taskResult.value)
        if (userResult.status === 'fulfilled') setUsers(userResult.value.users)
        if (teamResult.status === 'fulfilled') setTeams(teamResult.value.teams)
        const failedResult = [taskResult, userResult, teamResult].find((result) => result.status === 'rejected')
        if (failedResult) setError(failedResult.reason.message)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!tasks.some((task) => task.timerRunning)) return undefined
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [tasks])

  useEffect(() => {
    const warnings = tasks
      .filter((task) => task.timerRunning && task.estimatedMinutes
        && getElapsedSeconds(task, timerNow) >= task.estimatedMinutes * 60
        && !overtimeNotified.current.has(String(task.id)))
      .map((task) => ({
        taskId: String(task.id),
        title: task.title,
        estimate: formatDuration(task.estimatedMinutes * 60),
        elapsed: formatDuration(getElapsedSeconds(task, timerNow)),
      }))
    if (!warnings.length) return
    warnings.forEach((warning) => overtimeNotified.current.add(warning.taskId))
    setOvertimeWarnings((current) => [...current, ...warnings])
  }, [tasks, timerNow])

  useEffect(() => {
    const root = pageContentRef.current
    if (!root) return undefined

    const targets = root.querySelectorAll('.stat-card, .panel:not(.note-card), .mini-stats > div')
    if (!('IntersectionObserver' in window)) {
      targets.forEach((element) => element.classList.add('scroll-reveal', 'is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' })

    targets.forEach((element, index) => {
      element.classList.add('scroll-reveal')
      element.style.setProperty('--reveal-order', String(index % 5))
      observer.observe(element)
    })

    return () => observer.disconnect()
  }, [activePage, isLoading, tasks, teams])

  const counts = useMemo(() => {
    const totals = { total: tasks.length, completed: 0, in_progress: 0, pending: 0, overdue: 0 }
    for (const task of tasks) totals[getTaskStatus(task)] += 1
    return totals
  }, [tasks])

  const pageTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    let result = tasks
    if (activePage === 'priority') result = result.filter((task) => task.priority === 'high')
    if (activePage === 'team') result = result.filter((task) => task.isTeamTask)
    if (activePage === 'projects') result = [...result].sort((a, b) => a.project.localeCompare(b.project))
    if (query) {
      result = result.filter((task) =>
        [task.title, task.project, task.assignee, task.teamName ?? '', task.priority, task.status, ...task.teamMembers.map((member) => member.name)]
          .some((value) => value.toLowerCase().includes(query)),
      )
    }
    return result
  }, [activePage, search, tasks])

  const pageTeams = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return teams
    return teams.filter((team) =>
      [team.name, ...team.members.map((member) => member.name)]
        .some((value) => value.toLowerCase().includes(query)),
    )
  }, [search, teams])

  async function saveTask(values) {
    try {
      const path = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks'
      await requestJson(path, {
        method: editingTask ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      })
      setIsModalOpen(false)
      setEditingTask(null)
      await refreshTasks()
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    }
  }

  async function updateTaskStatus(task, nextStatus) {
    const status = nextStatus ?? (task.status === 'completed' ? 'pending' : 'completed')
    try {
      await requestJson(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await refreshTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function updateMemberProgress(task, status) {
    try {
      await requestJson(`/api/tasks/${task.id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await refreshTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function removeTask(task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    try {
      await requestJson(`/api/tasks/${task.id}`, { method: 'DELETE' })
      setOpenMenuId(null)
      await refreshTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function openCreateModal() {
    setEditingTask(null)
    setIsModalOpen(true)
    refreshUsers()
    refreshTeams()
  }

  function openCreateNote() {
    notesPageRef.current?.create()
  }

  function openTeamModal() {
    setEditingTeam(null)
    setIsTeamModalOpen(true)
    refreshUsers()
  }

  function openEditTeamModal(team) {
    setEditingTeam(team)
    setIsTeamModalOpen(true)
    refreshUsers()
  }

  function openEditModal(task) {
    setEditingTask(task)
    setOpenMenuId(null)
    setIsModalOpen(true)
    refreshUsers()
    refreshTeams()
  }

  async function saveTeam(values) {
    const { inviteEmails = [], ...teamValues } = values
    const result = await requestJson(editingTeam ? `/api/teams/${editingTeam.id}` : '/api/teams', {
      method: editingTeam ? 'PATCH' : 'POST',
      body: JSON.stringify(teamValues),
    })
    if (inviteEmails.length) {
      await requestJson(`/api/teams/${result.team.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ emails: inviteEmails }),
      })
    }
    await refreshTeams()
    setIsTeamModalOpen(false)
    setEditingTeam(null)
  }

  async function removeTeam(team) {
    if (!window.confirm(`Delete "${team.name}"? Teams with tasks cannot be deleted.`)) return
    try {
      await requestJson(`/api/teams/${team.id}`, { method: 'DELETE' })
      setTeams((existing) => existing.filter((item) => String(item.id) !== String(team.id)))
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function removeTeamMember(team, member) {
    if (!window.confirm(`Remove ${member.name} from ${team.name}? They will lose access to this team's tasks.`)) return
    try {
      await requestJson(`/api/teams/${team.id}/members/${member.id}`, { method:'DELETE' })
      setTeams((current) => current.map((item) => String(item.id) === String(team.id)
        ? { ...item, members: item.members.filter((person) => String(person.id) !== String(member.id)) }
        : item))
      await refreshTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function selectSearchResult(result) {
    setIsMobileNavOpen(false)
    setSearch(result.searchTerm)
    onNavigate(result.page)
  }

  return (
    <div className="app-shell" data-theme={isDarkMode ? 'dark' : 'light'} style={{ '--sidebar-width': `${sidebarWidth}px` }}>
      <Sidebar
        activePage={activePage}
        taskCount={tasks.length}
        user={user}
        width={sidebarWidth}
        minWidth={MIN_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
        onResize={resizeSidebar}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onEditProfile={() => setIsProfileOpen(true)}
        isMobileMenuOpen={isMobileNavOpen}
        onCloseMobileMenu={() => setIsMobileNavOpen(false)}
      />
      <main className="main-content">
        <Topbar pageTitle={pageLabels[activePage]} user={user} tasks={tasks} teams={teams} onLogout={onLogout} onEditProfile={() => setIsProfileOpen(true)} onNavigate={(page) => { setIsMobileNavOpen(false); onNavigate(page) }} onSelectSearchResult={selectSearchResult} isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} isMobileNavOpen={isMobileNavOpen} onToggleMobileNav={() => setIsMobileNavOpen((isOpen) => !isOpen)} />
        <div className="page-content" key={activePage} ref={pageContentRef}>
          <PageHeading activePage={activePage} user={user} onCreate={openCreateModal} onCreateNote={openCreateNote} onCreateTeam={openTeamModal} />
          {(error || logoutError) && (
            <div className="error-banner" role="alert">
              <span>{logoutError || error}</span>
              <button type="button" onClick={logoutError ? onLogout : () => refreshTasks(true)}>{logoutError ? 'Try sign out again' : 'Try again'}</button>
            </div>
          )}

          {activePage === 'overview' && (
            <>
              <SummaryCards counts={counts} />
              <DashboardPanels tasks={tasks} user={user} counts={counts} isLoading={isLoading} onEdit={openEditModal} onNavigate={onNavigate} />
            </>
          )}

          {activePage === 'activity' && <DashboardPanels tasks={tasks} user={user} counts={counts} isLoading={isLoading} onEdit={openEditModal} onNavigate={onNavigate} activityPage />}

          {activePage === 'reports' && (
            <>
              <SummaryCards counts={counts} includeOverdue />
              <TaskReport counts={counts} tasks={tasks} />
            </>
          )}

          {activePage === 'team' && <TeamManagementPanel teams={pageTeams} isLoading={isLoading} currentUser={user} onCreate={openTeamModal} onEdit={openEditTeamModal} onDelete={removeTeam} onRemoveMember={removeTeamMember} search={search} />}
          {activePage === 'projects' && <ProjectsPage tasks={tasks} isLoading={isLoading} search={search} onSearch={setSearch} timerNow={timerNow} onCreate={openCreateModal} onEdit={openEditModal} onDelete={removeTask} onToggle={updateTaskStatus} onProgress={updateMemberProgress} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />}
          {activePage === 'calendar' && <CalendarPage tasks={pageTasks} isLoading={isLoading} search={search} onSearch={setSearch} onEdit={openEditModal} />}
          {activePage === 'ai' && <AIAssistantPage tasks={tasks} teams={teams} />}
          {activePage === 'notes' && <NotesPage ref={notesPageRef} isDarkMode={isDarkMode} />}
          {activePage === 'settings' && <SettingsPage user={user} isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} onEditProfile={() => setIsProfileOpen(true)} onLogout={onLogout} />}

          {activePage !== 'overview' && activePage !== 'activity' && activePage !== 'reports' && activePage !== 'ai' && activePage !== 'notes' && activePage !== 'calendar' && activePage !== 'settings' && activePage !== 'projects' && (
            <>
              <MiniStats counts={counts} />
              <TaskTable
                title={activePage === 'priority' ? 'High-priority tasks' : activePage === 'calendar' ? 'Upcoming schedule' : activePage === 'projects' ? 'Tasks by project' : activePage === 'team' ? 'Team tasks' : activePage === 'settings' ? 'Workspace tasks' : 'All tasks'}
                tasks={pageTasks}
                timerNow={timerNow}
                isLoading={isLoading}
                search={search}
                onSearch={setSearch}
                onCreate={openCreateModal}
                onEdit={openEditModal}
                onDelete={removeTask}
                onToggle={updateTaskStatus}
                onProgress={updateMemberProgress}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            </>
          )}
        </div>
      </main>
      {overtimeWarnings.length > 0 && (
        <div className="overtime-alert-stack" aria-live="assertive">
          {overtimeWarnings.map((warning) => (
            <section className="overtime-alert" key={warning.taskId} role="alert">
              <span className="overtime-alert-mark">!</span>
              <div><strong>Task time exceeded</strong><p>{warning.title} has run for {warning.elapsed} (estimate: {warning.estimate}).</p></div>
              <button
                aria-label={`Dismiss overtime warning for ${warning.title}`}
                className="icon-button"
                onClick={() => setOvertimeWarnings((current) => current.filter((item) => item.taskId !== warning.taskId))}
                type="button"
              >×</button>
            </section>
          ))}
        </div>
      )}
      {isModalOpen && (
        <TaskModal
          key={editingTask?.id ?? 'new'}
          task={editingTask}
          users={users}
          teams={teams}
          allTasks={tasks}
          currentUser={user}
          onClose={() => {
            setIsModalOpen(false)
            setEditingTask(null)
          }}
          onSave={saveTask}
        />
      )}
      {isProfileOpen && (
        <ProfilePhotoDialog
          user={user}
          onClose={() => setIsProfileOpen(false)}
          onUpload={updateProfilePicture}
          onRemove={removeProfilePicture}
        />
      )}
      {isTeamModalOpen && (
        <TeamModal
          key={editingTeam?.id ?? 'new'}
          team={editingTeam}
          users={users}
          currentUser={user}
          onClose={() => {
            setIsTeamModalOpen(false)
            setEditingTeam(null)
          }}
          onSave={saveTeam}
        />
      )}
    </div>
  )
}
