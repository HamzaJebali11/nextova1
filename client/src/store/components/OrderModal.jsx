import { useEffect, useId, useRef } from 'react'
import { useAnimate, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import OrderForm from './OrderForm'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches

// Order form in a pop-up: centered modal on desktop, bottom sheet on phones.
// It stays mounted while closed (hidden and inert) so typed details survive closing it.
export default function OrderModal({ open, onClose, lines }) {
  const { t, pick, money } = useStore()
  const [scope, animate] = useAnimate()
  const reduce = useReducedMotion()
  const titleId = useId()
  const closeRef = useRef(null)
  const openRef = useRef(open)
  const returnFocus = useRef(null)
  const didMount = useRef(false)

  useEffect(() => { openRef.current = open })

  // Show / hide animation
  useEffect(() => {
    const root = scope.current
    if (!root) return
    const backdrop = root.querySelector('[data-backdrop]')
    const panel = root.querySelector('[data-panel]')
    const desktop = isDesktop()
    const opts = { duration: reduce ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }

    if (open) {
      returnFocus.current = document.activeElement
      animate(root, { visibility: 'visible' }, { duration: 0 })
      animate(backdrop, { opacity: [0, 1] }, opts)
      animate(
        panel,
        desktop ? { opacity: [0, 1], scale: [0.95, 1], y: 0 } : { y: ['100%', '0%'], opacity: 1, scale: 1 },
        opts,
      )
      requestAnimationFrame(() => closeRef.current?.focus())
    } else if (didMount.current) {
      Promise.all([
        animate(backdrop, { opacity: 0 }, opts),
        animate(panel, desktop ? { opacity: 0, scale: 0.95 } : { y: '100%' }, opts),
      ]).then(() => {
        if (!openRef.current) animate(root, { visibility: 'hidden' }, { duration: 0 })
      })
      const el = returnFocus.current
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus()
    }
    didMount.current = true
  }, [open, animate, scope, reduce])

  // Lock page scroll and listen for Esc while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Keep Tab focus inside the dialog
  function trapFocus(e) {
    if (e.key !== 'Tab') return
    const panel = scope.current?.querySelector('[data-panel]')
    const items = [...(panel?.querySelectorAll(FOCUSABLE) || [])].filter((el) => el.offsetParent !== null)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={scope}
      inert={!open}
      className="invisible fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6"
    >
      <div data-backdrop aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/50 opacity-0" />

      <div
        data-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-e3 md:max-h-[90vh] md:max-w-lg md:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
          <span aria-hidden="true" className="absolute start-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-300 md:hidden rtl:translate-x-1/2" />
          <h2 id={titleId} className="text-lg font-bold">{t('orderDetails')}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-black/5"
          >
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {/* Pack and variant summary */}
          <div className="mb-5 rounded-2xl bg-white p-3">
            <div className="mb-2 text-xs font-semibold text-gray-600">{t('yourOrder')}</div>
            <ul className="space-y-2.5">
              {lines.map((l) => (
                <li key={`${l.productId}|${l.variantName || ''}`} className="flex items-center gap-3 text-sm">
                  {l.image && (
                    <img src={optimizeImg(l.image, 120)} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{pick(l.name)}</div>
                    <div className="text-xs text-gray-600">
                      {l.variantName ? `${l.variantName} · ` : ''}
                      {l.qty} × {money(l.price)}
                    </div>
                    {l.giftQty > 0 && (
                      <div className="text-xs font-semibold text-ink">🎁 {t('freeGift')} × {l.giftQty}</div>
                    )}
                  </div>
                  <div className="font-semibold">{money(Math.round(l.price * l.qty * 100) / 100)}</div>
                </li>
              ))}
            </ul>
          </div>

          <OrderForm lines={lines} />
        </div>
      </div>
    </div>
  )
}
