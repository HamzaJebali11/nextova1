// Resolves once the page has loaded and the browser is idle, or on the visitor's first
// interaction (tap, key, scroll), whichever comes first. Used for non-essential scripts
// (Microsoft Clarity, popups) so they never compete with the first screen.
let ready = null

export function whenIdle() {
  if (ready) return ready
  ready = new Promise((resolve) => {
    let done = false
    const go = () => {
      if (done) return
      done = true
      events.forEach((e) => window.removeEventListener(e, go, opts))
      resolve()
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    const opts = { passive: true, once: true }
    events.forEach((e) => window.addEventListener(e, go, opts))

    const idle = () => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 4000 })
      else setTimeout(go, 2500)
    }
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
  })
  return ready
}
