import Avatar from './Avatar'
import Icon from './Icon'
import { navigation } from '../constants/navigation'

export default function Sidebar({
  activePage,
  taskCount,
  user,
  width,
  minWidth,
  maxWidth,
  onResize,
  onNavigate,
  onLogout,
  onEditProfile,
  isMobileMenuOpen = false,
  onCloseMobileMenu,
}) {
  function resizeWithKeyboard(event) {
    let nextWidth
    if (event.key === 'ArrowLeft') nextWidth = width - 12
    else if (event.key === 'ArrowRight') nextWidth = width + 12
    else if (event.key === 'Home') nextWidth = minWidth
    else if (event.key === 'End') nextWidth = maxWidth
    else return
    event.preventDefault()
    onResize(nextWidth)
  }

  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={() => onNavigate('overview')}>
        <span className="brand-mark"><img alt="" src="/tracklap-logo.svg" /></span>
        <span>TRACK<span className="brand-light">LAP</span></span>
      </a>
      <nav className={`main-nav${isMobileMenuOpen ? ' is-open' : ''}`} id="workspace-mobile-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <button aria-label={item.label} aria-current={activePage === item.id ? 'page' : undefined} className={`nav-link ${activePage === item.id ? 'active' : ''}`} key={item.id} onClick={() => { onCloseMobileMenu?.(); onNavigate(item.id) }} title={item.label} type="button">
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
            {item.id === 'tasks' && taskCount > 0 && <span className="nav-count">{taskCount}</span>}
          </button>
        ))}
      </nav>
      <div className="focus-card">
        <div className="focus-icon"><Icon name="spark" size={21} /></div>
        <div className="focus-title">Stay focused</div>
        <p>Organize tasks, prioritize work and get more done.</p>
      </div>
      <div className="sidebar-profile">
        <button className="profile-open" onClick={onEditProfile} type="button" aria-label="Edit profile picture and profile">
          <Avatar name={user.name} src={user.avatarUrl} className="avatar-sidebar" />
          <span className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></span>
        </button>
        <button className="icon-button logout-button" onClick={onLogout} aria-label="Sign out" title="Sign out" type="button"><Icon name="logout" size={17} /></button>
      </div>
      <div
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemax={maxWidth}
        aria-valuemin={minWidth}
        aria-valuenow={width}
        className="sidebar-resizer"
        onKeyDown={resizeWithKeyboard}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) onResize(event.clientX)
        }}
        role="separator"
        tabIndex={0}
      />
    </aside>
  )
}
