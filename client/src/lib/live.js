import { getToken } from './api'
import { whenIdle } from './idle'

// "Live visitors" heartbeat (Step 42), storefront only.
// Sends ONLY: the anonymous visitor id the shop already keeps (nx_vid), the kind of page, the product id on a
// product page, and phone / tablet / desktop. No name, phone, address or anything personal.
// - after the page is idle, then every 30 s while the tab is visible; stops while hidden, sends again when shown
// - never from the admin pages, never in the admin's own browser (admin login present)
// - fire and forget: keepalive, no waiting, every failure is silent; it does not touch Meta Pixel, Clarity
//   or the visitor statistics (separate route and collection)
const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1'
const EVERY = 30 * 1000
const MIN_GAP = 10 * 1000 // a page change sends at most every 10 s (the server allows about 6 a minute)

const state = { path: '/', search: '', productId: null, cart: false }
let started = false
let firstSent = false // nothing goes out before the first heartbeat (after load + idle)
let timer = 0
let lastSent = 0
let pendingChange = 0

const visitorId = () => {
  try { return localStorage.getItem('nx_vid') } catch { return null }
}

function pageType() {
  const { path, search } = state
  if (state.cart) return 'cart'
  if (path === '/') return 'home'
  if (path === '/shop') return new URLSearchParams(search).get('category') ? 'category' : 'shop'
  if (path.startsWith('/product/')) return 'product'
  if (path.startsWith('/checkout')) return 'checkout'
  if (path.startsWith('/order-success')) return 'confirmation'
  return 'other'
}

// touch screens: phone or tablet by the screen's shortest side; a mouse / trackpad = desktop
const device = () => {
  try {
    if (!window.matchMedia('(pointer: coarse)').matches) return 'desktop'
    const side = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight)
    return side < 600 ? 'phone' : 'tablet'
  } catch {
    return 'desktop'
  }
}

function skip() {
  try {
    return !!getToken() || state.path.startsWith('/admin') || document.visibilityState !== 'visible'
  } catch {
    return true
  }
}

function send() {
  if (skip()) return
  const id = visitorId()
  if (!id) return // the visit counter creates the id on the first page; the next beat will have it
  const page = pageType()
  const body = { visitorId: id, page, device: device() }
  if (page === 'product' && state.productId) body.productId = state.productId
  lastSent = Date.now()
  try {
    fetch(`${BASE}/stats/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, // a simple request: no CORS preflight
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {})
  } catch {
    // never break the page because of counting
  }
}

function schedule() {
  clearInterval(timer)
  timer = 0
  if (document.visibilityState === 'visible') timer = setInterval(send, EVERY)
}

function onVisibility() {
  if (document.visibilityState === 'visible') { send(); schedule() } else { clearInterval(timer); timer = 0 }
}

// the storefront calls this on every page change (StoreLayout)
export function livePage(path, search) {
  state.path = path
  state.search = search || ''
  if (!path.startsWith('/product/')) state.productId = null
  if (!started) {
    started = true
    whenIdle().then(() => {
      firstSent = true
      send()
      schedule()
      document.addEventListener('visibilitychange', onVisibility)
    })
    return
  }
  soon()
}

// a change (other page, product loaded, cart opened): send soon, at most every 10 s; the 30 s rhythm continues
function soon() {
  if (!firstSent) return
  clearTimeout(pendingChange)
  pendingChange = setTimeout(send, Math.max(0, MIN_GAP - (Date.now() - lastSent)))
}

// the product page tells which product is shown; the cart drawer tells when it is open
export function liveProduct(id) {
  const next = id || null
  if (next === state.productId) return
  state.productId = next
  if (next) soon() // the product often loads after the first heartbeat: tell the server which one
}
export function liveCart(open) {
  if (state.cart === !!open) return
  state.cart = !!open
  soon()
}
