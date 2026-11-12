import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestJson } from '../api/client'
import Avatar from './Avatar'
import EmptyState from './EmptyState'
import Icon from './Icon'
import LoadingState from './LoadingState'
import TaskTable from './TaskTable'
import { formatDate } from '../utils/date'
import { getTaskStatus } from '../utils/task'

function getProjects(tasks) {
  const projects = new Map()
  for (const task of tasks) {
    const name = task.project?.trim() || 'Unassigned project'
    const key = name.toLocaleLowerCase()
    if (!projects.has(key)) projects.set(key, { name, tasks: [] })
    projects.get(key).tasks.push(task)
  }

  const today = new Date().toISOString().slice(0, 10)
  return [...projects.values()].map((project) => {
    const completed = project.tasks.filter((task) => getTaskStatus(task, today) === 'completed').length
    const openTasks = project.tasks.filter((task) => getTaskStatus(task, today) !== 'completed')
    const overdue = project.tasks.filter((task) => getTaskStatus(task, today) === 'overdue').length
    const highPriority = openTasks.filter((task) => task.priority === 'high').length
    const nextDue = openTasks.map((task) => task.dueDate).filter((date) => date && date >= today).sort()[0]
    const members = new Map()
    for (const task of project.tasks) {
      if (task.isTeamTask) {
        for (const member of task.teamMembers ?? []) members.set(String(member.id), member)
      } else if (task.assignee) {
        members.set(String(task.assigneeId ?? task.assignee), { id: task.assigneeId ?? task.assignee, name: task.assignee, avatarUrl: task.assigneeAvatarUrl })
      }
    }
    return { ...project, completed, open: openTasks.length, overdue, highPriority, nextDue, members: [...members.values()] }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export default function ProjectsPage({ tasks, isLoading, search, onSearch, timerNow, onCreate, onEdit, onDelete, onToggle, onProgress, openMenuId, setOpenMenuId }) {
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectRecords,setProjectRecords]=useState([])
  const [projectError,setProjectError]=useState('')
  const [projectDialog,setProjectDialog]=useState(null)
  const [projectForm,setProjectForm]=useState({name:'',description:'',goal:'',startDate:'',targetDate:''})
  const [isSavingProject,setIsSavingProject]=useState(false)
  const [projectFilter,setProjectFilter]=useState('active')
  useEffect(()=>{let active=true;requestJson('/api/projects').then(result=>{if(active)setProjectRecords(result.projects)}).catch(()=>{});return()=>{active=false}},[])
  const projects = useMemo(() => {
    const list=getProjects(tasks)
    const byName=new Map(list.map((item,index)=>[item.name.toLocaleLowerCase(),index]))
    for(const record of projectRecords){const key=record.name.toLocaleLowerCase();if(byName.has(key)){list[byName.get(key)].record=record;continue}list.push({name:record.name,tasks:[],completed:0,open:0,overdue:0,highPriority:0,nextDue:record.targetDate,members:[],record});byName.set(key,list.length-1)}
    return list.sort((a,b)=>a.name.localeCompare(b.name))
  }, [tasks,projectRecords])
  function openProjectForm(project=null){setProjectError('');setProjectForm(project?{name:project.name,description:project.record?.description??'',goal:project.record?.goal??'',startDate:project.record?.startDate??'',targetDate:project.record?.targetDate??''}:{name:'',description:'',goal:'',startDate:'',targetDate:''});setProjectDialog(project??{record:null})}
  async function saveProject(event){event.preventDefault();setIsSavingProject(true);setProjectError('');const body={name:projectForm.name.trim(),description:projectForm.description.trim(),goal:projectForm.goal.trim(),startDate:projectForm.startDate||null,targetDate:projectForm.targetDate||null};try{if(projectDialog?.record){const record=await requestJson(`/api/projects/${projectDialog.record.id}`,{method:'PATCH',body:JSON.stringify(body)});setProjectRecords(current=>current.map(item=>item.id===record.id?record:item))}else{const record=await requestJson('/api/projects',{method:'POST',body:JSON.stringify(body)});setProjectRecords(current=>[...current,record]);setProjectFilter('active')}setProjectDialog(null)}catch(error){setProjectError(error.message)}finally{setIsSavingProject(false)}}
  async function editProject(project){if(project.record)openProjectForm(project)}
  async function toggleArchive(project){const archive=!project.record?.archivedAt;try{let record=project.record;if(!record){record=await requestJson('/api/projects',{method:'POST',body:JSON.stringify({name:project.name})})}await requestJson(`/api/projects/${record.id}/archive`,{method:'PATCH',body:JSON.stringify({archive})});const updated={...record,archivedAt:archive?new Date().toISOString():null};setProjectRecords(current=>current.some(item=>item.id===updated.id)?current.map(item=>item.id===updated.id?updated:item):[...current,updated])}catch(error){setProjectError(error.message)}}
  const query = search.trim().toLocaleLowerCase()
  const visibleProjects = projects.filter((project) => (projectFilter==='all'||(projectFilter==='archived'?Boolean(project.record?.archivedAt):!project.record?.archivedAt))&&(!query || [project.name, ...project.tasks.flatMap((task) => [task.title, task.assignee, task.teamName ?? '', ...((task.teamMembers ?? []).map((member) => member.name))])].some((value) => value?.toLocaleLowerCase().includes(query))))
  const currentProject = selectedProject && projects.find((project) => project.name === selectedProject)

  if (currentProject) {
    const projectTasks = currentProject.tasks.filter((task) => !query || [task.title, task.assignee, task.teamName ?? '', task.priority, task.status, ...((task.teamMembers ?? []).map((member) => member.name))].some((value) => value?.toLocaleLowerCase().includes(query)))
    return (
      <div className="projects-detail-view">
        <button className="text-button projects-back-button" onClick={() => { setSelectedProject(null); onSearch('') }} type="button"><Icon name="arrow" size={15} /> All projects</button>
        <section className="panel project-detail-summary">
          <div className="project-detail-title"><span className="project-card-icon"><Icon name="folder" size={20} /></span><div><p className="eyebrow">PROJECT OVERVIEW</p><h2>{currentProject.name}</h2></div></div>
          <div className="project-detail-stats"><span><strong>{currentProject.tasks.length}</strong> tasks</span><span><strong>{currentProject.completed}</strong> completed</span><span><strong>{currentProject.open}</strong> open</span><span><strong>{currentProject.overdue + currentProject.highPriority}</strong> need attention</span><button className="secondary-button" onClick={()=>currentProject.record?editProject(currentProject):openProjectForm(currentProject)} type="button">{currentProject.record?'Edit details':'Add project details'}</button><button className="secondary-button" onClick={()=>toggleArchive(currentProject)} type="button">{currentProject.record?.archivedAt?'Restore project':'Archive project'}</button></div>
        </section>
        {currentProject.record&&(currentProject.record.description||currentProject.record.goal)&&<section className="panel project-detail-description"><strong>{currentProject.record.goal||'Project goal'}</strong><p>{currentProject.record.description}</p></section>}
        <TaskTable title={`${currentProject.name} tasks`} tasks={projectTasks} isLoading={isLoading} search={search} onSearch={onSearch} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} onProgress={onProgress} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} timerNow={timerNow} />
      </div>
    )
  }

  return (
    <section className="projects-overview">
      <div className="projects-overview-heading"><div><p className="eyebrow">PROJECT PORTFOLIO</p><h2>Work at a glance</h2><p>Track progress, upcoming deadlines, and where your attention is needed.</p><div className="project-toolbar"><button className="primary-button project-create-button" onClick={()=>openProjectForm()} type="button"><Icon name="plus" size={15}/> New project</button><label className="project-filter-label">Projects<select aria-label="Filter projects" onChange={event=>setProjectFilter(event.target.value)} value={projectFilter}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All projects</option></select></label></div>{projectError&&<p className="form-error" role="alert">{projectError}</p>}</div><label className="search-field"><Icon name="search" size={17} /><input aria-label="Search projects" onChange={(event) => onSearch(event.target.value)} placeholder="Search projects or tasks..." value={search} /></label></div>
      {isLoading ? <div className="panel"><LoadingState /></div> : visibleProjects.length ? (
        <div className="project-card-grid">
          {visibleProjects.map((project, index) => {
            const progress = project.tasks.length ? Math.round((project.completed / project.tasks.length) * 100) : 0
            return (
              <button className="panel project-overview-card" key={project.name} onClick={() => setSelectedProject(project.name)} style={{ '--project-order': index % 6 }} type="button">
                <span className={`project-card-icon project-color-${index % 4}`}><Icon name="folder" size={20} /></span>
                <span className="project-card-title"><strong>{project.name}</strong><span>{project.record?.archivedAt?'Archived · ':''}{project.tasks.length} {project.tasks.length === 1 ? 'task' : 'tasks'}</span></span>
                <span className="project-progress-label"><span>Progress</span><strong>{progress}%</strong></span>
                <span className="project-progress-track"><span style={{ width: `${progress}%` }} /></span>
                <span className="project-card-meta">
                  <span><Icon name="calendar" size={14} />{project.nextDue ? `Next ${formatDate(project.nextDue)}` : 'No upcoming deadline'}</span>
                  <span className={project.overdue || project.highPriority ? 'project-attention' : ''}><Icon name="flag" size={14} />{project.overdue ? `${project.overdue} overdue` : project.highPriority ? `${project.highPriority} high priority` : project.open ? `${project.open} open` : 'All complete'}</span>
                </span>
                <span className="project-card-footer"><span className="project-member-stack">{project.members.slice(0, 4).map((member) => <Avatar key={member.id} name={member.name} src={member.avatarUrl} />)}{project.members.length > 4 && <span className="project-member-more">+{project.members.length - 4}</span>}{!project.members.length && <span className="project-no-members">No assignees</span>}</span><span className="project-open-link">Open project <Icon name="arrow" size={15} /></span></span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="panel"><EmptyState title={query ? 'No matching projects' : 'No projects yet'} description={query ? 'Try searching for a different project or task.' : 'Create tasks and give them a project name to see your project overview here.'} actionLabel={!query ? 'Create a task' : undefined} onAction={onCreate} /></div>
      )}
      {!isLoading && projects.length > 0 && <p className="projects-total">{visibleProjects.length} of {projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>}
      {projectDialog!==null&&createPortal(<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!isSavingProject)setProjectDialog(null)}}><section aria-labelledby="project-dialog-title" aria-modal="true" className="task-modal project-form-modal" role="dialog"><div className="modal-heading"><div><p className="eyebrow">PROJECT DETAILS</p><h2 id="project-dialog-title">{projectDialog.record?'Edit project':'Create project'}</h2></div><button aria-label="Close" className="icon-button" disabled={isSavingProject} onClick={()=>setProjectDialog(null)} type="button">×</button></div><form className="project-form" onSubmit={saveProject}><label className="form-field full-width">Project name<input autoFocus maxLength="120" onChange={event=>setProjectForm(current=>({...current,name:event.target.value}))} placeholder="e.g. Website redesign" required value={projectForm.name}/></label><label className="form-field full-width">Description<textarea maxLength="2000" onChange={event=>setProjectForm(current=>({...current,description:event.target.value}))} placeholder="What is this project about?" rows="3" value={projectForm.description}/></label><label className="form-field full-width">Goal<input maxLength="240" onChange={event=>setProjectForm(current=>({...current,goal:event.target.value}))} placeholder="What does success look like?" value={projectForm.goal}/></label><div className="form-grid"><label className="form-field">Start date<input onChange={event=>setProjectForm(current=>({...current,startDate:event.target.value}))} type="date" value={projectForm.startDate}/></label><label className="form-field">Target date<input onChange={event=>setProjectForm(current=>({...current,targetDate:event.target.value}))} type="date" value={projectForm.targetDate}/></label></div>{projectError&&<p className="form-error" role="alert">{projectError}</p>}<div className="modal-actions"><button className="secondary-button" disabled={isSavingProject} onClick={()=>setProjectDialog(null)} type="button">Cancel</button><button className="primary-button" disabled={isSavingProject||!projectForm.name.trim()} type="submit">{isSavingProject?'Saving…':projectDialog.record?'Save changes':'Create project'}</button></div></form></section></div>,document.querySelector('.app-shell')??document.body)}
    </section>
  )
}
