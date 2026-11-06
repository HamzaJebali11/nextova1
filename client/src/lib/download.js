import { getToken } from './api'

const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1'

// downloads a protected file (the browser cannot send your login with a plain link)
export async function downloadFile(path, filename) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) throw new Error('Download failed. Please log in again and retry.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}