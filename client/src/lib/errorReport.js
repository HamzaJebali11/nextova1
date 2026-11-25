// Sends browser errors (ErrorBoundary, window errors, unhandled promise rejections) to the server's
// System status page. Small, de-duplicated and limited to a few per minute per visitor. No form data,
// no customer details: only the error message and the page path.
const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`
const sent = new Set()
let times = []

export function reportError(kind, message) {
  try {
    const msg = String(message || 'Unknown error').slice(0, 300)
    const key = `${kind}|${msg}`
    if (sent.has(key)) return // the same error only once per page load
    const now = Date.now()
    times = times.filter((t) => now - t < 60000)
    if (times.length >= 3) return // at most 3 per minute
    sent.add(key)
    times.push(now)
    const body = JSON.stringify({ kind, message: msg, page: window.location.pathname.slice(0, 200) })
    fetch(`${BASE}/system/client-errors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit' }).catch(() => {})
  } catch {
    // never let error reporting cause an error
  }
}

export function startErrorReporting() {
  window.addEventListener('error', (e) => {
    // errors from other sites' scripts (browser extensions, ad scripts) carry no message: skip them
    if (!e.message || e.message === 'Script error.') return
    reportError('error', `${e.message}${e.filename ? ` @ ${e.filename.split('/').pop()}:${e.lineno}` : ''}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    // network problems are already shown to the visitor as friendly messages
    if (r?.network || r?.status) return
    reportError('rejection', r?.message || String(r))
  })
}
