const KEY = 'nx_utm'

export function captureUtm() {
  const p = new URLSearchParams(window.location.search)
  const found = {}
  ;['source', 'medium', 'campaign'].forEach((k) => {
    const v = p.get(`utm_${k}`)
    if (v) found[k] = v.slice(0, 100)
  })
  if (Object.keys(found).length) sessionStorage.setItem(KEY, JSON.stringify(found))
}

export function getUtm() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || undefined
  } catch {
    return undefined
  }
}