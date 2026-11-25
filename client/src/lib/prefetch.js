import { api } from './api'
import { imgSrcSet, optimizeImg } from './image'

// Starts the data requests a page needs BEFORE React has rendered, so the product (and its first picture)
// arrive sooner on slow phones. Each promise is used once by the page that needs it.

const cache = new Map()

// the gallery's `sizes`: full width on phones, about half the page on desktop
export const GALLERY_SIZES = '(min-width: 768px) 50vw, 100vw'

function preloadImage(url) {
  if (!url || document.querySelector(`link[data-preload="${url}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.setAttribute('fetchpriority', 'high')
  link.dataset.preload = url
  const set = imgSrcSet(url)
  if (set) {
    link.setAttribute('imagesrcset', set)
    link.setAttribute('imagesizes', GALLERY_SIZES)
  } else {
    link.href = optimizeImg(url, 900)
  }
  document.head.appendChild(link)
}

export function startPrefetch() {
  try {
    // requests already started by the small script in index.html (earliest possible)
    const early = window.__nxPrefetch || {}
    for (const [path, p] of Object.entries(early)) {
      // a failed early request falls back to a normal one when the page asks for it
      cache.set(path, p.catch(() => api(path)))
    }
    window.__nxPrefetch = {}
    if (!cache.has('/settings')) cache.set('/settings', api('/settings'))
    if (!cache.has('/events/active')) cache.set('/events/active', api('/events/active'))
    const m = window.location.pathname.match(/^\/product\/([^/?#]+)/)
    if (m) {
      const path = `/products/${decodeURIComponent(m[1])}`
      if (!cache.has(path)) cache.set(path, api(path))
      const p = cache.get(path)
      // the first product picture is the largest thing on screen: start it as soon as we know it
      p.then((d) => preloadImage(d?.product?.images?.[0]?.url)).catch(() => {})
    }
  } catch {
    // prefetching is only a speed-up
  }
}

// the prefetched request for this path (only once), or a normal request
export function fetchOnce(path) {
  const p = cache.get(path)
  if (p) {
    cache.delete(path)
    return p
  }
  return api(path)
}
