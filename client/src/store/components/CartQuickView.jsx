import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'framer-motion'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { packLabel } from '../../lib/pricing'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import Recommendations from './Recommendations'

// Cart icon + quick view (header). Hover opens it on desktop, a tap or the keyboard toggles it.
// It never opens by itself after "Add to cart". All prices come from the cart provider (existing
// pricing code): line total = line price x quantity, total = cart subtotal. Nothing is recalculated here.
export default function CartQuickView({ headerHidden = false }) {
  const { t, lang, pick, money } = useStore()
  const { items, count, subtotal, setQty, remove, setOpen: openDrawer } = useCart()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const button = useRef(null)
  const panel = useRef(null)
  const leaveTimer = useRef(0)
  const panelId = useId()
  const [cartScope, animateCart] = useAnimate()

  // bounce when a product lands in the cart (lib/flyToCart.js aims at [data-cart-icon])
  useEffect(() => {
    if (reduce) return
    const bump = () => {
      if (cartScope.current) animateCart(cartScope.current, { scale: [1, 1.3, 0.9, 1.1, 1] }, { duration: 0.5, ease: 'easeOut' })
    }
    window.addEventListener('nx:cart-bump', bump)
    return () => window.removeEventListener('nx:cart-bump', bump)
  }, [animateCart, cartScope, reduce])

  // close: outside click, Esc, scrolling on phones
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onScroll = () => { if (window.matchMedia('(max-width: 767px)').matches) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [open])

  useEffect(() => () => clearTimeout(leaveTimer.current), [])
  // the header slides away on scroll down: the panel closes with it
  const shown = open && !headerHidden

  const hoverOpen = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(leaveTimer.current)
    setOpen(true)
  }
  const hoverClose = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setOpen(false), 180)
  }
  function toggle(e) {
    const next = !open
    setOpen(next)
    // opened from the keyboard: move focus into the panel
    if (next && e.detail === 0) requestAnimationFrame(() => panel.current?.querySelector('button, a')?.focus())
  }
  const go = (fn) => () => {
    setOpen(false)
    fn()
  }
  const isPack = (i) => i.qty > 1 && (i.packs || []).some((p) => Number(p.qty) === i.qty)

  // phones: the page behind the open panel does not scroll (the page keeps its scroll position; the dim layer
  // takes the touches and the panel scrolls on its own), and it is exactly where it was when the panel closes
  useEffect(() => {
    if (!shown || !window.matchMedia('(max-width: 767px)').matches) return
    const y = window.scrollY
    const html = document.documentElement.style
    const prev = html.overflow
    html.overflow = 'hidden'
    return () => {
      html.overflow = prev
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y)
    }
  }, [shown])

  return (
    <div ref={wrap} className="relative" onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
      <button ref={button} type="button" onClick={toggle} aria-label={`${t('cart')}: ${count}`}
        aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog"
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full p-2 hover:bg-black/5">
        <span ref={cartScope} data-cart-icon className="relative inline-grid">
          <ShoppingBag size={22} aria-hidden="true" />
          {count > 0 && (
            <motion.span key={count} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
              className="absolute -end-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {count}
            </motion.span>
          )}
        </span>
        {count > 0 && <span className="hidden text-sm font-semibold md:inline" dir="ltr">{money(subtotal)}</span>}
      </button>

      {/* light dim behind the open panel (above the sticky Order now bar and the WhatsApp button, below the
          header): a tap on it closes the panel. In a portal at <body>: the header's transform would otherwise
          pin a "fixed" layer to the header box instead of the screen. */}
      {shown && createPortal(
        <div aria-hidden="true" onClick={() => setOpen(false)}
          className="nx-cart-dim fixed inset-0 z-[var(--z-dropdown-overlay)] touch-none bg-[var(--glass-overlay)]" />,
        document.body,
      )}
      <AnimatePresence>
        {shown && (
          <motion.div ref={panel} id={panelId} role="dialog" aria-label={t('yourCart')}
            onClickCapture={(e) => { if (e.target.closest('a')) setOpen(false) }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            className="glass glass-solid nx-drop absolute end-0 top-full z-[var(--z-dropdown)] mt-2 flex w-[min(92vw,22rem)] flex-col text-ink">
            <div className="shrink-0 border-b px-4 py-3 text-sm font-bold">{t('yourCart')}</div>

            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">{t('cartEmpty')}</p>
            ) : (
              <>
                {/* items + suggestions scroll; the title and the total always stay visible */}
                <div className="nx-noscrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <ul className="divide-y px-4">
                  {items.map((i) => (
                    <li key={i.key} className="py-3">
                      <div className="flex gap-3">
                        <img src={optimizeImg(i.image, 120)} alt="" width={56} height={56} loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-xl bg-quiet object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm font-semibold">{pick(i.name)}</div>
                          <div className="text-xs text-gray-600">
                            {[pick(i.variantLabel) || i.variantName, isPack(i) && packLabel(i.qty, lang)].filter(Boolean).join(' · ')}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <div className="glass-btn gap-0">
                              <button type="button" onClick={() => setQty(i.key, i.qty - 1)} disabled={i.qty <= 1}
                                aria-label={`${t('quantity')} −`} className="grid h-11 w-11 place-items-center rounded-full hover:bg-quiet disabled:opacity-40">
                                <Minus size={14} />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold" aria-live="polite">{i.qty}</span>
                              <button type="button" onClick={() => setQty(i.key, i.qty + 1)} disabled={i.qty >= 20}
                                aria-label={`${t('quantity')} +`} className="grid h-11 w-11 place-items-center rounded-full hover:bg-quiet disabled:opacity-40">
                                <Plus size={14} />
                              </button>
                            </div>
                            <span className="text-sm font-bold">{money(i.price * i.qty)}</span>
                            <button type="button" onClick={() => remove(i.key)} aria-label={`${t('remove')} ${pick(i.name)}`}
                              className="grid h-11 w-11 place-items-center rounded-full text-red-600 hover:bg-red-50">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {i.giftQty > 0 && (
                        <div className="mt-2 flex items-center gap-2 rounded-xl bg-quiet p-2 text-xs">
                          {i.gift?.image && <img src={optimizeImg(i.gift.image, 80)} alt="" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />}
                          <span>🎁 {pick(i.gift?.name)} × {i.giftQty} · <b>{t('freeCaps')}</b></span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <Recommendations compact exclude={items.map((i) => i.productId)} className="border-t px-4 py-3" />
                </div>
                <div className="shrink-0 border-t p-4">
                  <div className="mb-3 flex justify-between text-sm font-bold">
                    <span>{t('total')}</span><span>{money(subtotal)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={go(() => openDrawer(true))}
                      className="glass-btn px-3 text-sm">
                      {t('viewCart')}
                    </button>
                    <button type="button" onClick={go(() => navigate('/checkout'))}
                      className="btn-primary-glass px-3 text-sm">
                      {t('checkout')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
