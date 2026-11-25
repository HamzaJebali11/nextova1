import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../storeContext'

// Rotating top bar: one message at a time, every N seconds (admin setting, default 4), looping forever.
// Pauses on hover and while the tab is hidden. Reduced motion: the messages still change, without animation.
// The height is fixed, so the page never jumps.
export default function AnnouncementBar() {
  const { settings, lang } = useStore()
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  const hover = useRef(false)

  const list = (settings.announcements || [])
    .map((a) => (lang === 'ar' ? a.ar || a.en : a.en || a.ar))
    .filter(Boolean)
  // older single message, used while the list is empty
  const legacy = settings.announcementBar?.enabled ? settings.announcementBar?.[lang] || settings.announcementBar?.en : ''
  const messages = list.length ? list : legacy ? [legacy] : []
  const seconds = Math.max(2, Number(settings.announcementSeconds) || 4)
  const count = messages.length

  useEffect(() => {
    if (count < 2) return
    const id = setInterval(() => {
      if (hover.current || document.hidden) return
      setI((n) => (n + 1) % count)
    }, seconds * 1000)
    return () => clearInterval(id)
  }, [count, seconds])

  // while the settings are still loading, keep the bar's space (if the store had a bar last time), so the
  // header and the page do not jump down when the messages arrive
  const loaded = Object.keys(settings).length > 0
  let hadBar = true
  try { hadBar = localStorage.getItem('nx_has_bar') !== '0' } catch { /* storage blocked */ }
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem('nx_has_bar', count > 0 ? '1' : '0') } catch { /* optional */ }
  }, [loaded, count])
  if (!loaded) return hadBar ? <div className="h-9 bg-ink" aria-hidden="true" /> : null
  if (count === 0) return null
  const text = messages[i % count]

  return (
    <div
      className="relative h-9 overflow-hidden bg-ink text-white"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') hover.current = true }}
      onPointerLeave={() => { hover.current = false }}
      aria-live="off"
    >
      <AnimatePresence initial={false}>
        <motion.p
          key={`${i % count}-${text}`}
          initial={reduce ? false : { y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: '-100%', opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] font-medium md:text-[13px]"
        >
          <span className="truncate">{text}</span>
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
