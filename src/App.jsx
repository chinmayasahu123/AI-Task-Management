import { useEffect, useState } from 'react'
import { useAuth } from './auth/useAuth'
import AuthPage from './pages/AuthPage'
import LandingPage from './pages/LandingPage'
import WorkspacePage from './pages/WorkspacePage'
import { navigation } from './constants/navigation'
import { requestJson } from './api/client'
import './App.css'

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = localStorage.getItem('tracklap-current-page')
    return navigation.some(({ id }) => id === savedPage) ? savedPage : navigation[0].id
  })
  const [authMode, setAuthMode] = useState(null)
  const [logoutError, setLogoutError] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('tracklap-theme') === 'dark')
  const { user, isLoading, loadError, signOut } = useAuth()

  useEffect(() => {
    localStorage.setItem('tracklap-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    localStorage.setItem('tracklap-current-page', currentPage)
  }, [currentPage])

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('teamInvite')
    if (!user || !token) return
    requestJson('/api/teams/invitations/accept', { method:'POST', body:JSON.stringify({ token }) })
      .then(({ message }) => { window.history.replaceState({}, '', window.location.pathname); window.alert(message) })
      .catch((error) => { window.history.replaceState({}, '', window.location.pathname); window.alert(error.message) })
  }, [user])

  if (isLoading) return <div className="loading-state auth-loading"><span className="spinner" />Checking your session...</div>
  if (!user) {
    return (
      <LandingPage initialError={loadError} onOpenAuth={setAuthMode}>
        {authMode && (
          <AuthPage
            key={authMode}
            initialError={loadError}
            initialMode={authMode}
            onClose={() => setAuthMode(null)}
          />
        )}
      </LandingPage>
    )
  }

  async function logout() {
    try {
      await signOut()
      setLogoutError('')
      setCurrentPage(navigation[0].id)
    } catch (error) {
      setLogoutError(error.message)
    }
  }

  return (
    <WorkspacePage
      user={user}
      isDarkMode={isDarkMode}
      onToggleTheme={() => setIsDarkMode((dark) => !dark)}
      onLogout={logout}
      logoutError={logoutError}
      activePage={currentPage}
      onNavigate={setCurrentPage}
    />
  )
}
