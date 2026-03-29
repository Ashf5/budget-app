const BASE_URL = 'http://localhost:3001'

// In-memory token store — avoids circular dependency with AuthContext
let _accessToken: string | null = null
let _refreshToken: string | null = null
let _onUnauthorized: (() => void) | null = null

export function setTokens(access: string | null, refresh: string | null) {
  _accessToken = access
  _refreshToken = refresh
}

export function registerUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && retry && _refreshToken) {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    })

    if (refreshRes.ok) {
      const data = (await refreshRes.json()) as { accessToken: string }
      _accessToken = data.accessToken
      localStorage.setItem('accessToken', data.accessToken)
      return request<T>(path, options, false)
    } else {
      _onUnauthorized?.()
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' })
  },
}
