import { useEffect, useState } from 'react'
import { api, getToken, setToken } from '../lib/api'
import { AuthCtx } from './useAuth'

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api('/auth/me')
      .then(setAdmin)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    setToken(null)
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    setToken(data.token)
    setAdmin(data.admin)
  }

  function logout() {
    setToken(null)
    setAdmin(null)
  }

  return <AuthCtx.Provider value={{ admin, loading, login, logout }}>{children}</AuthCtx.Provider>
}