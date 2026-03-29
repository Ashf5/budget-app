import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { api, setTokens, registerUnauthorizedHandler } from '../lib/api'

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface AuthContextValue {
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setAccessToken(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setTokens(null, null)
  }, [])

  useEffect(() => {
    const storedAccess = localStorage.getItem('accessToken')
    const storedRefresh = localStorage.getItem('refreshToken')
    if (storedAccess && storedRefresh) {
      setAccessToken(storedAccess)
      setTokens(storedAccess, storedRefresh)
    }
    registerUnauthorizedHandler(logout)
    setIsLoading(false)
  }, [logout])

  const persistAndSet = (tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken)
    localStorage.setItem('accessToken', tokens.accessToken)
    localStorage.setItem('refreshToken', tokens.refreshToken)
    setTokens(tokens.accessToken, tokens.refreshToken)
  }

  const login = async (email: string, password: string) => {
    const tokens = await api.post<AuthTokens>('/auth/login', { email, password })
    persistAndSet(tokens)
  }

  const register = async (email: string, password: string) => {
    const tokens = await api.post<AuthTokens>('/auth/register', { email, password })
    persistAndSet(tokens)
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isAuthenticated: accessToken !== null,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
