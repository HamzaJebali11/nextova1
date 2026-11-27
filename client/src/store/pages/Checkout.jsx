import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { track } from '../../lib/pixel'
import { useStore } from '../storeContext'
import { usePageMeta } from '../../lib/seo'
import { useCart } from '../../cart/cartContext'
import QtyStepper from '../components/QtyStepper'
import OrderForm from '../components/OrderForm'
import Recommendations from '../components/Recommendations'

export default function Checkout() {
  const { t, pick, money } = useStore()
  usePageMeta({ title: t('checkoutTitle'), robots: 'noindex' })
  const { items, setQty, remove, clear } = useCart()
  const has = items.length > 0

  useEffect(() => {
    if (has) track('InitiateCheckout', { currency: 'QAR' })
  }, [has])

  if (!has) {
    return (
      <div className="px-4 py-24 text-center">
        <h1 className="mb-4 text-lg font-normal text-gray-600">{t('cartEmpty')}</h1>
        <Link to="/shop" className="btn-primary-glass px-6">{t('continueShopping')}</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-[var(--page-pad)] py-8">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">{t('checkoutTitle')}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="glass order-2 rounded-2xl p-5 lg:order-1 lg:row-span-2">
          <h2 className="mb-4 font-bold">{t('orderDetails')}</h2>
          <OrderForm lines={items} onPlaced={clear} />
        </div>

        <div className="glass order-1 h-fit rounded-2xl p-5 lg:order-2">
          <h2 className="mb-2 font-bold">{t('orderSummary')}</h2>
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.key} className="flex gap-3 py-3">
                <img src={optimizeImg(i.image, 120)} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl bg-white object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium">{pick(i.name)}</div>
                  {i.variantName && <div className="text-sm font-semibold text-emerald-700">{pick(i.variantLabel) || i.variantName}</div>}
                  <div className="mt-1 text-sm font-semibold">{money(i.price * i.qty)}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <QtyStepper value={i.qty} onChange={(q) => setQty(i.key, q)} />
                    <button onClick={() => remove(i.key)} className="rounded-full p-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
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
        </div>

        <Recommendations exclude={items.map((i) => i.productId)}
          className="glass order-3 h-fit min-w-0 rounded-2xl p-4 lg:col-start-2" />
      </div>
    </div>
  )
}