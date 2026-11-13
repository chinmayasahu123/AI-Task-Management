import Avatar from './Avatar'
import Icon from './Icon'
import { useEffect, useState } from 'react'
import './SettingsPage.css'
import { requestJson } from '../api/client'

const features = [
  ['check', 'Task management', 'Create tasks, assign priorities, set due dates, and track progress.'],
  ['calendar', 'Calendar', 'See tasks on their due dates and review each day’s workload.'],
  ['users', 'Team workspaces', 'Organize shared work and follow each member’s progress.'],
  ['note', 'Notes and folders', 'Save ideas as colored notes and organize them into folders.'],
  ['chart', 'Reports and activity', 'Review task status and your daily create and complete activity.'],
  ['spark', 'AI assistance', 'Get optional task breakdowns, priorities, summaries, and search.'],
]

export default function SettingsPage({ user, isDarkMode, onToggleTheme, onEditProfile, onLogout }) {
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false)
  const [passwordMessage,setPasswordMessage]=useState('')
  const [deletePassword,setDeletePassword]=useState('')

  useEffect(() => {
    if (!isPhotoPreviewOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsPhotoPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPhotoPreviewOpen])
  async function changePassword(event){event.preventDefault();const form=new FormData(event.currentTarget);const currentPassword=form.get('currentPassword');const newPassword=form.get('newPassword');const confirm=form.get('confirmPassword');if(newPassword!==confirm){setPasswordMessage('New passwords do not match.');return}try{const result=await requestJson('/api/auth/password/change',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});setPasswordMessage(result.message);event.currentTarget.reset()}catch(error){setPasswordMessage(error.message)}}
  async function deleteAccount(event){event.preventDefault();if(!window.confirm('Permanently delete your account, tasks, teams, notes, and profile data? This cannot be undone.'))return;try{await requestJson('/api/auth/account',{method:'DELETE',body:JSON.stringify({password:deletePassword})});await onLogout()}catch(error){setPasswordMessage(error.message)}}
  return (
    <div className="settings-page">
      <section className="panel settings-profile-card">
        <div className="settings-profile-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h2>Profile information</h2><p>Your account details and profile picture.</p></div><button className="secondary-button" onClick={onEditProfile} type="button"><Icon name="settings" size={15} /> Edit profile picture</button></div>
        <div className="settings-profile-details">
          <button className="settings-profile-photo-button" onClick={() => setIsPhotoPreviewOpen(true)} type="button" aria-label="View profile picture"><Avatar className="settings-profile-avatar" name={user.name} src={user.avatarUrl} /></button>
          <div className="settings-profile-field"><span>Full name</span><strong>{user.name}</strong></div>
          <div className="settings-profile-field"><span>Email address</span><strong>{user.email}</strong></div>
          <div className="settings-profile-field"><span>Account</span><strong>Active</strong></div>
        </div>
      </section>

      <section className="settings-preferences panel">
        <div><p className="eyebrow">APPEARANCE</p><h2>Theme</h2><p>Choose how Tracklap looks on this device.</p></div>
        <button aria-pressed={isDarkMode} className="settings-theme-button" onClick={onToggleTheme} type="button"><span className="settings-theme-icon"><Icon name={isDarkMode ? 'moon' : 'sun'} size={18} /></span><span><strong>{isDarkMode ? 'Dark mode' : 'Light mode'}</strong><small>Click to switch to {isDarkMode ? 'light' : 'dark'} mode</small></span><span className={`settings-toggle${isDarkMode ? ' is-on' : ''}`}><i /></span></button>
      </section>

      <form className="panel settings-password-form" onSubmit={changePassword}><div><p className="eyebrow">SECURITY</p><h2>Change password</h2><p>Use at least 8 characters for your new password.</p></div><label>Current password<input autoComplete="current-password" minLength="8" name="currentPassword" required type="password"/></label><label>New password<input autoComplete="new-password" minLength="8" name="newPassword" required type="password"/></label><label>Confirm new password<input autoComplete="new-password" minLength="8" name="confirmPassword" required type="password"/></label>{passwordMessage&&<p role="status">{passwordMessage}</p>}<button className="primary-button" type="submit">Update password</button></form>
      <form className="panel settings-delete-account" onSubmit={deleteAccount}><div><p className="eyebrow">DANGER ZONE</p><h2>Delete account</h2><p>This permanently removes your account and its associated workspace data.</p></div><label>Confirm with your password<input autoComplete="current-password" onChange={event=>setDeletePassword(event.target.value)} required type="password" value={deletePassword}/></label><button className="team-delete-button" type="submit">Delete my account</button></form>

      <section className="settings-features-section">
        <div className="settings-section-heading"><div><p className="eyebrow">WHAT YOU CAN DO</p><h2>Tracklap features</h2><p>Tools available in your workspace.</p></div></div>
        <div className="settings-feature-grid">{features.map(([icon, title, description], index) => <article className={`settings-feature-card settings-feature-${index}`} key={title}><span className="settings-feature-icon"><Icon name={icon} size={18} /></span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
      </section>
      {isPhotoPreviewOpen && <div className="settings-photo-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setIsPhotoPreviewOpen(false)}><section className="settings-photo-preview" role="dialog" aria-modal="true" aria-label="Profile picture"><button className="icon-button" onClick={() => setIsPhotoPreviewOpen(false)} type="button" aria-label="Close profile picture"><Icon name="close" size={17} /></button>{user.avatarUrl ? <img className="settings-photo-full" src={user.avatarUrl} alt={`${user.name}'s profile picture`} /> : <Avatar className="settings-photo-large" name={user.name} />}</section></div>}
    </div>
  )
}
