import { useEffect, useState } from 'react'
import { api } from '../lib/api'

// Live visitors for the admin (Step 42): ONE shared poll for the sidebar dot, the Visitors card and the
// dashboard chip. Every 15 s while this admin tab is visible; paused while it is hidden (the server also
// caches the answer for 5 s, so several admin tabs do not load the database).
const EVERY = 15 * 1000
let data = null
let timer = 0
const subs = new Set()

const emit = () => subs.forEach((fn) => fn(data))

async function load() {
  if (document.visibilityState !== 'visible') return
  try {
    data = await api('/stats/live')
    emit()
  } catch {
    // keep the last number; the next poll tries again
  }
}

function start() {
  if (timer) return
  load()
  timer = setInterval(load, EVERY)
}
function stop() {
  clearInterval(timer)
  timer = 0
}
const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop())

export function useLive() {
  const [value, setValue] = useState(data)
  useEffect(() => {
    subs.add(setValue)
    if (subs.size === 1) {
      document.addEventListener('visibilitychange', onVisibility)
      if (document.visibilityState === 'visible') start()
    }
    return () => {
      subs.delete(setValue)
      if (subs.size === 0) {
        stop()
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [])
  return value
}
