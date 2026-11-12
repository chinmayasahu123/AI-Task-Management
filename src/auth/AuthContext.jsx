import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestJson } from '../api/client'
import { AuthContext } from './context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    requestJson('/api/auth/me')
      .then(({ user: currentUser }) => {
        if (active) {
          setUser(currentUser)
          setLoadError('')
        }
      })
      .catch((error) => {
        if (active) {
          setUser(null)
          if (error.status !== 401) setLoadError(error.message)
          else setLoadError('')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (credentials) => {
    const result = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    setUser(result.user)
  }, [])

  const register = useCallback(async (account) => {
    return requestJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(account),
    })
  }, [])

  const updateProfilePicture = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('avatar', file)
    const result = await requestJson('/api/auth/avatar', {
      method: 'POST',
      body: formData,
    })
    setUser(result.user)
  }, [])

  const removeProfilePicture = useCallback(async () => {
    const result = await requestJson('/api/auth/avatar', { method: 'DELETE' })
    setUser(result.user)
  }, [])

  const signOut = useCallback(async () => {
    await requestJson('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, loadError, signIn, register, signOut, updateProfilePicture, removeProfilePicture }),
    [user, isLoading, loadError, signIn, register, signOut, updateProfilePicture, removeProfilePicture],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
