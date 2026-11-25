import { useEffect } from 'react'

// Per-page <title>, meta description, robots and Open Graph tags (Google reads them after rendering).
// Every tag set here is restored / removed when the page closes, so pages never inherit each other's tags.
// Note: Facebook / WhatsApp link previews do not run JavaScript; they read the static tags in index.html.
function setTag(attr, key, value) {
  if (value === undefined || value === null || value === '') return () => {}
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  const created = !el
  const prev = el?.getAttribute('content')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', String(value))
  return () => (created ? el.remove() : el.setAttribute('content', prev ?? ''))
}

export function usePageMeta({ title, description, robots, image, type = 'website' } = {}) {
  useEffect(() => {
    const prevTitle = document.title
    if (title) document.title = title
    const desc = description ? String(description).replace(/\s+/g, ' ').trim().slice(0, 160) : ''
    const undo = [
      setTag('name', 'description', desc),
      setTag('name', 'robots', robots),
      setTag('property', 'og:title', title),
      setTag('property', 'og:description', desc),
      setTag('property', 'og:type', type),
      setTag('property', 'og:url', window.location.origin + window.location.pathname),
      setTag('property', 'og:image', image),
    ]
    return () => {
      document.title = prevTitle
      undo.forEach((u) => u())
    }
  }, [title, description, robots, image, type])
}
