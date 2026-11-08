import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Gift, X } from 'lucide-react'
import { claimOffer, hasOffer } from '../../lib/offer'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'

const SEEN = 'nx_exit_seen'
const DAY = 24 * 60 * 60 * 1000
const seenRecently = () => {
  const v = Number(localStorage.getItem(SEEN))
  return !!v && Date.now() - v < DAY
}

const T = {
  en: {
    title: 'Wait! Here is {n}% off',
    sub: 'Finish your order now and we take {n}% off. One time per customer, for the next 24 hours.',
    claim: 'Claim {n}% off',
    no: 'No thanks',
  },
  ar: {
    title: 'لحظة! خصم {n}% لك',
    sub: 'أكمل طلبك الآن ونخصم {n}% من قيمته. مرة واحدة لكل عميل خلال 24 ساعة.',
    claim: 'احصل على خصم {n}%',
    no: 'لا شكرًا',
  },
}

export default function ExitOffer() {
  const { settings, lang } = useStore()
  const { items } = useCart()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)

  const x = T[lang] || T.en
  const offer = settings.exitOffer
  const percent = Number(offer?.percent) || 0
  const hasCart = items.length > 0
  const eligible =
    !!offer?.enabled && percent > 0 &&
    (hasCart || sessionStorage.getItem('nx_lead') === '1') &&
    !pathname.startsWith('/order-success')

  useEffect(() => {
    if (!eligible || show) return
    let idle

    function trigger() {
      if (hasOffer() || seenRecently()) return
      localStorage.setItem(SEEN, String(Date.now()))
      setShow(true)
    }
    const arm = () => {
      clearTimeout(idle)
      idle = setTimeout(trigger, 45000) // phones: after 45 seconds without touching the screen
    }
    const onLeave = (e) => { if (e.clientY <= 0) trigger() } // computers: the mouse leaves through the top

    document.addEventListener('mouseleave', onLeave)
    const events = ['touchstart', 'scroll', 'keydown', 'click', 'mousemove']
    events.forEach((ev) => window.addEventListener(ev, arm, { passive: true }))
    arm()

    return () => {
      clearTimeout(idle)
      document.removeEventListener('mouseleave', onLeave)
      events.forEach((ev) => window.removeEventListener(ev, arm))
    }
  }, [eligible, show])

  useEffect(() => {
    if (!show) return
    const onKey = (e) => { if (e.key === 'Escape') setShow(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  function claim() {
    claimOffer()
    setShow(false)
    navigate(hasCart ? '/checkout?offer=1' : `${pathname}?offer=1`)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShow(false)}>
          <motion.div onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
            <button onClick={() => setShow(false)} aria-label="Close"
              className="absolute end-3 top-3 rounded-full p-2 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <Gift size={32} />
            </div>
            <h2 className="text-2xl font-extrabold">{x.title.replace('{n}', percent)}</h2>
            <p className="mt-2 text-sm text-gray-600">{x.sub.replace('{n}', percent)}</p>
            <button onClick={claim}
              className="mt-6 w-full rounded-full bg-emerald-600 py-3.5 font-semibold text-white transition hover:bg-emerald-500">
              {x.claim.replace('{n}', percent)}
            </button>
            <button onClick={() => setShow(false)} className="mt-3 text-sm text-gray-500 hover:underline">{x.no}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}