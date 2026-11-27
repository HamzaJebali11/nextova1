import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ShoppingBag, Trash2, X } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { useDialogFocus } from '../../lib/useDialogFocus'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import QtyStepper from './QtyStepper'
import Recommendations from './Recommendations'
import { liveCart } from '../../lib/live'

export default function CartDrawer() {
  const { t, lang, pick, money, settings } = useStore()
  const { items, open, setOpen, setQty, remove, subtotal } = useCart()
  const navigate = useNavigate()
  const panel = useRef(null)
  useDialogFocus(panel, open)
  // live visitors: an open cart counts as "in cart" (anonymous heartbeat, lib/live.js)
  useEffect(() => { liveCart(open) }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const freeFrom = Number(settings.freeDeliveryThreshold) || 0
  const left = Math.max(0, freeFrom - subtotal)
  const offscreen = lang === 'ar' ? '-100%' : '100%'

  function goCheckout() {
    setOpen(false)
    navigate('/checkout')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="nx-overlay fixed inset-0 z-[var(--z-drawer)] flex justify-end bg-[var(--glass-overlay)]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.aside ref={panel} role="dialog" aria-modal="true" aria-label={t('yourCart')} tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="glass glass-float flex h-full w-full max-w-md flex-col rounded-none border-s outline-none"
            initial={{ x: offscreen }} animate={{ x: 0 }} exit={{ x: offscreen }}
            transition={{ type: 'tween', duration: 0.25 }}>
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold"><ShoppingBag size={20} /> {t('yourCart')}</h2>
              <button onClick={() => setOpen(false)} aria-label={t('close')} className="grid h-11 w-11 place-items-center rounded-full hover:bg-quiet"><X size={20} /></button>
            </div>

            {items.length === 0 ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div>
                  <p className="mb-4 text-gray-500">{t('cartEmpty')}</p>
                  <button onClick={() => { setOpen(false); navigate('/shop') }}
                    className="btn-primary-glass px-6">{t('continueShopping')}</button>
                </div>
              </div>
            ) : (
              <>
                {freeFrom > 0 && (
                  <div className="border-b bg-emerald-50 p-4 text-sm">
                    <p className="mb-2 font-medium text-emerald-800">
                      {left > 0 ? t('freeDeliveryLeft').replace('{amt}', money(left)) : t('freeDeliveryUnlocked')}
                    </p>
                    <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                      <motion.div className="h-full rounded-full bg-emerald-500"
                        animate={{ width: `${Math.min(100, (subtotal / freeFrom) * 100)}%` }} />
                    </div>
                  </div>
                )}

                <ul className="flex-1 divide-y overflow-y-auto px-4">
                  {items.map((i) => (
                    <li key={i.key} className="flex gap-3 py-4">
                      <img src={optimizeImg(i.image, 160)} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-quiet object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-medium">{pick(i.name)}</div>
                        {i.variantName && <div className="text-sm font-semibold text-emerald-700">{pick(i.variantLabel) || i.variantName}</div>}
                        <div className="mt-1 text-sm font-semibold">{money(i.price * i.qty)}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <QtyStepper value={i.qty} onChange={(q) => setQty(i.key, q)} />
                          <button onClick={() => remove(i.key)} aria-label={t('remove')}
                            className="tap-44 rounded-full p-2 text-red-500 hover:bg-red-50"><Trash2 size={18} /></button>
                        </div>
                        {i.giftQty > 0 && (
                          <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 p-2 text-xs text-emerald-800">
                            {i.gift.image && (
                              <img src={optimizeImg(i.gift.image, 80)} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
                            )}
                            <span>🎁 {pick(i.gift.name)} × {i.giftQty} · <b>{t('freeCaps')}</b></span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <Recommendations exclude={items.map((i) => i.productId)} className="border-t px-4 py-3" />

                <div className="border-t p-4">
                  <div className="mb-3 flex justify-between font-semibold">
                    <span>{t('subtotal')}</span><span>{money(subtotal)}</span>
                  </div>
                  <button onClick={goCheckout}
                    className="btn-primary-glass w-full py-3.5">
                    {t('checkout')}
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}