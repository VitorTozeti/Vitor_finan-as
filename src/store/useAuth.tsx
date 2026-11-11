import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, AuthUser, getToken, onUnauthorized, setToken, ApiError } from '../services/api'

type AuthStatus = 'loading' | 'anon' | 'authed'

interface AuthValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)
const USER_CACHE_KEY = 'greenfinance:auth-user'

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function cacheUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_CACHE_KEY)
  } catch {
    // ignora
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? readCachedUser() : null))
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? (readCachedUser() ? 'authed' : 'loading') : 'anon'))

  const clear = useCallback(() => {
    setToken(null)
    cacheUser(null)
    setUser(null)
    setStatus('anon')
  }, [])

  useEffect(() => {
    onUnauthorized(clear)
    return () => onUnauthorized(null)
  }, [clear])

  // Confirma a sessão salva. Offline, mantém o usuário em cache (app segue
  // funcionando com os dados locais e sincroniza quando a rede voltar).
  useEffect(() => {
    if (!getToken()) return
    api<{ user: AuthUser }>('/me')
      .then(({ user }) => {
        cacheUser(user)
        setUser(user)
        setStatus('authed')
      })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) clear()
        else if (!readCachedUser()) clear()
      })
  }, [clear])

  const finish = (data: { token: string; user: AuthUser }) => {
    setToken(data.token)
    cacheUser(data.user)
    setUser(data.user)
    setStatus('authed')
  }

  const login = useCallback(async (email: string, password: string) => {
    finish(await api('/auth/login', { method: 'POST', json: { email, password } }))
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    finish(await api('/auth/register', { method: 'POST', json: { email, password, name } }))
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // mesmo sem rede, encerra localmente
    }
    clear()
  }, [clear])

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
