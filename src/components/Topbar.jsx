import Avatar from './Avatar'
import GlobalSearch from './GlobalSearch'
import Icon from './Icon'
import TimeWeather from './TimeWeather'
import { useState } from 'react'
import { requestJson } from '../api/client'

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}

export default function Topbar({ pageTitle, user, tasks, teams, onLogout, onEditProfile, onNavigate, onSelectSearchResult, isDarkMode, onToggleTheme, isMobileNavOpen, onToggleMobileNav }) {
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 6 * 86400000)
  const [notifications,setNotifications]=useState([])
  const [showNotifications,setShowNotifications]=useState(false)
  const [unread,setUnread]=useState(0)
  async function toggleNotifications(){
    const open=!showNotifications;setShowNotifications(open)
    if(open){try{const result=await requestJson('/api/notifications');setNotifications(result.notifications);setUnread(result.unread)}catch{setNotifications([])}}
  }
  async function openNotification(item){
    if(!item.readAt){await requestJson(`/api/notifications/${item.id}/read`,{method:'PATCH'});setUnread(value=>Math.max(0,value-1))}
    setShowNotifications(false);onNavigate('tasks')
  }
  return (
    <header className="topbar">
      <div className="mobile-brand"><span className="brand-mark"><img alt="" src="/tracklap-logo.svg" /></span>TRACKLAP</div>
      <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
      <GlobalSearch tasks={tasks} teams={teams} onSelectResult={onSelectSearchResult} />
      <div className="topbar-actions">
        <button aria-controls="workspace-mobile-nav" aria-expanded={isMobileNavOpen} aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'} className="mobile-nav-toggle" onClick={onToggleMobileNav} type="button">
          <span className="mobile-nav-toggle-lines" aria-hidden="true"><i /><i /><i /></span>
        </button>
        <div className="topbar-utility-actions">
        <TimeWeather />
        <button
          aria-label={`View calendar for ${formatDate(today)} through ${formatDate(nextWeek)}`}
          className="date-range"
          onClick={() => onNavigate('calendar')}
          title="Open calendar"
          type="button"
        >
          <span className="date-dot" />{formatDate(today)} — {formatDate(nextWeek)}
        </button>
        <button
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          type="button"
        >
          <Icon className="icon-theme-enter" key={isDarkMode ? 'sun' : 'moon'} name={isDarkMode ? 'sun' : 'moon'} size={18} />
        </button>
        <div className="notification-wrap"><button className="icon-button notification-button" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} onClick={toggleNotifications} type="button"><Icon name="bell" size={19} />{unread>0&&<span className="notification-count">{unread}</span>}</button>{showNotifications&&<section className="notification-popover"><div><strong>Notifications</strong><button className="text-button" onClick={()=>setShowNotifications(false)} type="button">Close</button></div>{notifications.length?notifications.map(item=><button className={`notification-item${item.readAt?'':' unread'}`} key={item.id} onClick={()=>openNotification(item)} type="button"><span>{item.message}</span><small>{formatDate(String(item.createdAt).slice(0,10))}</small></button>):<p>No new notifications.</p>}</section>}</div>
        <button className="avatar-trigger" onClick={onEditProfile} aria-label="Edit profile picture" title="Edit profile picture" type="button">
          <Avatar name={user.name} src={user.avatarUrl} className="avatar-top" />
        </button>
        <button className="icon-button topbar-logout" onClick={onLogout} aria-label="Sign out" title="Sign out" type="button"><Icon name="logout" size={17} /></button>
        </div>
      </div>
    </header>
  )
}
