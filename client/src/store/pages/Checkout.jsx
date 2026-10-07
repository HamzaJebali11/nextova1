import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { giftCount } from '../../lib/pricing'
import { track } from '../../lib/pixel'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import QtyStepper from '../components/QtyStepper'
import OrderForm from '../components/OrderForm'

export default function Checkout() {
  const { t, pick, money } = useStore()
  const { items, setQty, remove, clear } = useCart()
  const has = items.length > 0

  useEffect(() => {
    if (has) track('InitiateCheckout', { currency: 'QAR' })
  }, [has])

  if (!has) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="mb-4 text-lg text-gray-600">{t('cartEmpty')}</p>
        <Link to="/shop" className="rounded-full bg-gray-900 px-6 py-2.5 text-white hover:bg-emerald-600">{t('continueShopping')}</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">{t('checkoutTitle')}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="order-2 rounded-2xl border bg-white p-5 shadow-sm lg:order-1">
          <h2 className="mb-4 font-bold">{t('orderDetails')}</h2>
          <OrderForm lines={items} onPlaced={clear} />
        </div>

        <div className="order-1 h-fit rounded-2xl border bg-gray-50 p-5 lg:order-2">
          <h2 className="mb-2 font-bold">{t('orderSummary')}</h2>
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.key} className="flex gap-3 py-3">
                <img src={optimizeImg(i.image, 120)} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium">{pick(i.name)}</div>
                  {i.variantName && <div className="text-xs text-gray-500">{i.variantName}</div>}
                  <div className="mt-1 text-sm font-semibold">{money(i.price * i.qty)}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <QtyStepper value={i.qty} onChange={(q) => setQty(i.key, q)} />
                    <button onClick={() => remove(i.key)} className="rounded-full p-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {giftCount(i) > 0 && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 p-2 text-xs text-emerald-800">
                      {i.gift.image && (
                        <img src={optimizeImg(i.gift.image, 80)} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      )}
                      <span>🎁 {pick(i.gift.name)} × {giftCount(i)} · <b>{t('freeCaps')}</b></span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}