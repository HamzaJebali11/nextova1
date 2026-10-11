// in production VITE_API_URL points to the API (for example https://nextova-api.onrender.com); locally it stays empty
const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1'

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

  if (res.status === 204) return null

  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  const data = isJson ? await res.json().catch(() => ({})) : {}

  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null)
      window.location.href = '/admin/login'
    }
    const err = new Error(data.message || 'Request failed')
    err.details = data.errors
    throw err
  }

  // a page that is not JSON means we reached the wrong server (for example the website itself)
  if (!isJson) throw new Error('The store could not reach its server. Please try again later.')
  return data
}