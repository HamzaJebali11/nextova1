import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ShoppingBag, X } from 'lucide-react'
import { api } from '../../lib/api'
import { FlagChips } from './OrderFlags'

const POLL_MS = 15000
const SHOW_MS = 6000
const MAX = 3

// a soft two-note chime (Web Audio: no sound file to download)
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[[660, 0], [880, 0.16]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.4)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // the browser may block sound until you click somewhere in the admin once
  }
}

function Toast({ t, onClose, onOpen }) {
  // each toast keeps its own 6 s, even when other toasts arrive and the list re-renders
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const id = setTimeout(() => closeRef.current(), SHOW_MS)
    return () => clearTimeout(id)
  }, [])
  return (
    <motion.div layout initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-auto flex w-[min(92vw,26rem)] items-start gap-3 rounded-2xl bg-ink p-3 pe-2 text-white shadow-2xl">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10" aria-hidden="true"><ShoppingBag size={18} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {t.firstName || 'Someone'} ordered {t.units} x {t.product}{t.more > 0 ? ` + ${t.more} more` : ''}
          </span>
          <span className="block text-xs text-white/70">
            {t.orderNumber}{t.zone ? ` · Zone ${t.zone}` : ''}{t.area ? ` · ${t.area}` : ''}
          </span>
          {(t.flags || t.held) && <span className="mt-1 block"><FlagChips flags={t.flags} held={t.held} /></span>}
        </span>
      </button>
      <button type="button" onClick={onClose} aria-label="Close notification" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
        <X size={16} />
      </button>
    </motion.div>
  )
}

// New website orders while the admin is open: a toast at the top (up to 3), optional chime,
// and onNew(n) so the layout can show "(n) New order" in the tab title.
export default function OrderToasts({ onNew }) {
  const navigate = useNavigate()
  const [toasts, setToasts] = useState([])
  const cursor = useRef(null)
  const sound = useRef(false)
  const onNewRef = useRef(onNew)
  useEffect(() => { onNewRef.current = onNew })

  useEffect(() => {
    let stopped = false
    api('/settings/admin').then((s) => { sound.current = !!s.orderSound }).catch(() => {})
    // start from the server's "now": orders that already exist never show a toast
    api('/orders/new-since').then((d) => { cursor.current = d.now }).catch(() => {})

    const poll = async () => {
      if (!cursor.current) return
      try {
        const d = await api(`/orders/new-since?after=${encodeURIComponent(cursor.current)}`)
        if (stopped) return
        cursor.current = d.now
        if (d.items.length > 0) {
          setToasts((list) => [...list, ...d.items.map((x) => ({ ...x, key: `${x.id}` }))].slice(-MAX))
          onNewRef.current?.(d.items.length)
          if (sound.current) chime()
        }
      } catch {
        // try again at the next tick
      }
    }
    const id = setInterval(poll, POLL_MS)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [])

  const close = (key) => setToasts((list) => list.filter((x) => x.key !== key))

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 print:hidden" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast key={t.key} t={t} onClose={() => close(t.key)}
            onOpen={() => { close(t.key); navigate(`/admin/orders?open=${t.id}`) }} />
        ))}
      </AnimatePresence>
    </div>
  )
}
