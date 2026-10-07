import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { AREAS } from '../areas'
import { useStore } from '../storeContext'

function ago(date, lang) {
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' })
  const mins = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000))
  if (mins < 60) return rtf.format(-mins, 'minute')
  if (mins < 1440) return rtf.format(-Math.round(mins / 60), 'hour')
  return rtf.format(-Math.round(mins / 1440), 'day')
}

export default function RecentOrderPopup() {
  const { t, lang, pick, settings } = useStore()
  const { pathname } = useLocation()
  const [orders, setOrders] = useState([])
  const [idx, setIdx] = useState(-1)
  const [off, setOff] = useState(() => sessionStorage.getItem('nx_popup_off') === '1')

  const enabled = settings.salesPopup !== false && !off
  const hiddenHere = ['/checkout', '/order-success'].some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    api('/orders/recent').then((d) => { if (!cancelled) setOrders(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [enabled])

  useEffect(() => {
    if (!enabled || orders.length === 0) return
    let i = 0
    let showTimer
    let hideTimer
    const cycle = () => {
      setIdx(i % orders.length)
      i += 1
      hideTimer = setTimeout(() => setIdx(-1), 6000)
      showTimer = setTimeout(cycle, 16000)
    }
    showTimer = setTimeout(cycle, 7000)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [enabled, orders])

  const o = enabled && !hiddenHere && idx >= 0 ? orders[idx] : null
  const area = o ? AREAS.find((a) => a.en === o.area) : null
  const areaName = area ? (lang === 'ar' ? area.ar : area.en) : o?.area

  function dismiss() {
    sessionStorage.setItem('nx_popup_off', '1')
    setOff(true)
    setIdx(-1)
  }

  return (
    <AnimatePresence>
      {o && (
        <motion.div key={idx} initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="fixed bottom-5 start-4 z-30 w-72 max-w-[calc(100vw_-_6.5rem)]">
          <Link to={o.product.slug ? `/product/${o.product.slug}` : '/shop'}
            className="flex items-center gap-3 rounded-2xl bg-white p-3 pe-9 shadow-xl ring-1 ring-black/5">
            <img src={optimizeImg(o.product.image, 120)} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-gray-100 object-cover" />
            <div className="min-w-0 text-xs leading-snug">
              <div className="truncate text-gray-600">
                <b className="text-gray-900">{o.firstName}</b>
                {areaName ? ` ${t('fromWord')} ${areaName}` : ''} {t('orderedLabel')}
              </div>
              <div className="truncate text-sm font-semibold text-gray-900">{pick(o.product.name)}</div>
              <div className="text-emerald-600">{ago(o.createdAt, lang)}</div>
            </div>
          </Link>
          <button onClick={dismiss} aria-label={t('close')}
            className="absolute end-2 top-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}