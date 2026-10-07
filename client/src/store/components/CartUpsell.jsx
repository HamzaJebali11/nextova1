import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'

export default function CartUpsell() {
  const { t, pick, money } = useStore()
  const { items, add } = useCart()
  const [list, setList] = useState([])

  useEffect(() => {
    let cancelled = false
    api('/products?sort=popular&limit=8')
      .then((d) => { if (!cancelled) setList(d.items) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const inCart = new Set(items.map((i) => i.productId))
  const picks = list
    .filter((p) => !inCart.has(p._id) && p.stock > 0 && !p.variants?.length && !p.packs?.length && !p.freeGift?.enabled)
    .slice(0, 4)

  if (picks.length === 0) return null

  return (
    <div className="border-t bg-gray-50 p-4">
      <div className="mb-2 text-sm font-semibold">{t('addMore')}</div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {picks.map((p) => (
          <div key={p._id} className="w-36 shrink-0 rounded-2xl border bg-white p-2">
            <img src={optimizeImg(p.images?.[0]?.url, 200)} alt="" className="aspect-square w-full rounded-xl bg-gray-100 object-cover" />
            <div className="mt-1 line-clamp-1 text-xs font-medium">{pick(p.name)}</div>
            <div className="text-xs font-bold">{money(p.price)}</div>
            <button
              onClick={() => add({ productId: p._id, slug: p.slug, name: p.name, image: p.images?.[0]?.url, price: p.price })}
              className="mt-1.5 w-full rounded-full bg-gray-900 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600">
              {t('addToCart')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}