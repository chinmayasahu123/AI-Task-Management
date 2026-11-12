export const navigation = [
  { id: 'overview', label: 'Dashboard', icon: 'home' },
  { id: 'activity', label: 'Recent Activity', icon: 'clock' },
  { id: 'tasks', label: 'Tasks', icon: 'check' },
  { id: 'notes', label: 'Notes', icon: 'note' },
  { id: 'projects', label: 'Projects', icon: 'folder' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'team', label: 'Team', icon: 'users' },
  { id: 'ai', label: 'AI Assistant', icon: 'spark' },
  { id: 'priority', label: 'Priority', icon: 'flag' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

export const pageLabels = Object.fromEntries(navigation.map(({ id, label }) => [id, label]))
