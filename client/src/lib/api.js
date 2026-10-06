const BASE = '/api/v1'

export const getToken = () => localStorage.getItem('nx_token')
export const setToken = (t) =>
  t ? localStorage.setItem('nx_token', t) : localStorage.removeItem('nx_token')

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null)
      window.location.href = '/admin/login'
    }
    const err = new Error(data.message || 'Request failed')
    err.details = data.errors
    throw err
  }
  return data
}