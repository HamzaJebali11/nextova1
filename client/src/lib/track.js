import { api, getToken } from './api'
import { getUtm } from './utm'

const KEY = 'nx_vid'

// a random anonymous id kept in this browser (no name, phone or other personal data)
function visitorId() {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, '')
    localStorage.setItem(KEY, id)
  }
  return id
}

let last = ''

export function trackVisit(path) {
  try {
    if (getToken() || path.startsWith('/admin')) return // your own visits are not counted
    if (path === last) return
    last = path

    let referrer
    if (document.referrer) {
      const host = new URL(document.referrer).hostname
      if (host && host !== window.location.hostname) referrer = host.replace(/^www\./, '')
    }
    api('/stats/hit', { method: 'POST', body: { visitorId: visitorId(), path, utm: getUtm(), referrer } }).catch(() => {})
  } catch {
    // never break the page because of counting
  }
}