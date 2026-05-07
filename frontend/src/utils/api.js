import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const tryRefresh = async () => {
  const refresh = getRefreshToken()
  if (!refresh) return false
  try {
    const res = await fetch(`${API_URL}/auth/login/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (res.ok) {
      const data = await res.json()
      setTokens(data.access, data.refresh || refresh)
      return true
    }
    return false
  } catch {
    return false
  }
}

const request = async (url, options = {}) => {
  const token = getAccessToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${url}`, { ...options, headers })

  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`
      return fetch(`${API_URL}${url}`, { ...options, headers })
    }
    clearTokens()
    window.location.href = '/login'
    return res
  }
  return res
}

export const api = {
  login: (data) =>
    request('/auth/login/', { method: 'POST', body: JSON.stringify(data) }),

  register: (data) =>
    request('/auth/register/', { method: 'POST', body: JSON.stringify(data) }),

  googleAuth: (token) =>
    request('/auth/google/', { method: 'POST', body: JSON.stringify({ token }) }),

  profile: () => request('/auth/profile/'),
}
