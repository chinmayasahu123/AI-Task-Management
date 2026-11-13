import Avatar from './Avatar'
import AnimatedList from './AnimatedList'
import EmptyState from './EmptyState'
import { useEffect, useState } from 'react'
import { requestJson } from '../api/client'

export default function TeamManagementPanel({ teams, isLoading, currentUser, onCreate, onEdit, onDelete, onRemoveMember, search = '' }) {
  const [invitations,setInvitations]=useState({})
  useEffect(()=>{let active=true;Promise.all(teams.filter(t=>String(t.leadId)===String(currentUser.id)).map(async team=>{try{const result=await requestJson(`/api/teams/${team.id}/invitations`);return[team.id,result.invitations]}catch{return[team.id,[]]}})).then(rows=>{if(active)setInvitations(Object.fromEntries(rows))});return()=>{active=false}},[teams,currentUser.id])
  async function cancelInvite(teamId,id){await requestJson(`/api/teams/${teamId}/invitations/${id}`,{method:'DELETE'});setInvitations(current=>({...current,[teamId]:(current[teamId]??[]).filter(item=>item.id!==id)}))}
  async function resendInvite(teamId,email){await requestJson(`/api/teams/${teamId}/invitations`,{method:'POST',body:JSON.stringify({emails:[email]})})}
  return (
    <section className="panel team-management-panel">
      <div className="task-panel-heading">
        <div><p className="eyebrow">YOUR GROUPS</p><h2>Teams and members</h2></div>
      </div>
      {isLoading ? (
        <div className="loading-state">Loading teams...</div>
      ) : teams.length ? (
        <AnimatedList className="team-card-grid" stagger={0.06}>
          {teams.map((team) => (
            <article className="team-card" key={team.id}>
              <div className="team-card-heading">
                <div><h3>{team.name}</h3><span>{team.members.length} members</span></div>
                <div className="team-card-actions">
                  {String(team.leadId) === String(currentUser.id) && (
                    <>
                      <span className="team-lead-tag">Team lead</span>
                      <button aria-label={`Add members to ${team.name}`} className="secondary-button" onClick={() => onEdit(team)} type="button">+ Add member</button>
                      <button aria-label={`Edit ${team.name}`} className="secondary-button" onClick={() => onEdit(team)} type="button">Edit</button>
                      <button aria-label={`Delete ${team.name}`} className="team-delete-button" onClick={() => onDelete(team)} type="button">Delete</button>
                    </>
                  )}
                </div>
              </div>
              <AnimatedList className="team-card-members" stagger={0.035}>
                {team.members.map((member) => (
                  <div className="team-card-member" key={member.id}>
                    <Avatar name={member.name} src={member.avatarUrl} />
                    <span>{member.name}</span>
                    {member.isLead && <span className="team-lead-tag">Lead</span>}
                    {!member.isLead && String(team.leadId) === String(currentUser.id) && <button aria-label={`Remove ${member.name} from ${team.name}`} className="team-member-remove" onClick={() => onRemoveMember(team, member)} title="Remove member" type="button">Remove</button>}
                  </div>
                ))}
              </AnimatedList>
              {String(team.leadId)===String(currentUser.id)&&(invitations[team.id]??[]).length>0&&<div className="team-pending-invites"><strong>Pending invitations</strong>{invitations[team.id].map(invite=><div key={invite.id}><span>{invite.email}</span><button onClick={()=>resendInvite(team.id,invite.email)} type="button">Resend</button><button onClick={()=>cancelInvite(team.id,invite.id)} type="button">Cancel</button></div>)}</div>}
            </article>
          ))}
        </AnimatedList>
      ) : (
        <EmptyState
          title={search ? 'No matching teams found' : 'You’re not in a team yet'}
          description={search ? 'Try another search to find a team or member.' : 'Create a team and choose other registered users to work together.'}
          actionLabel={!search ? 'Create a team' : undefined}
          onAction={!search ? onCreate : undefined}
        />
      )}
    </section>
  )
}
