import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'

const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

export default function ProductOffers({ f, set, selfId }) {
  const [products, setProducts] = useState([])

  useEffect(() => {
    api('/products/admin/all?limit=100').then((d) => setProducts(d.items)).catch(() => {})
  }, [])

  const base = Number(f.price) || 0
  const gift = f.freeGift
  const setPack = (i, patch) => set('packs', f.packs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const setGift = (patch) => set('freeGift', { ...gift, ...patch })
  const candidates = products.filter((p) => p._id !== selfId && p.isActive && !(p.variants?.length))

  return (
    <>
      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Pack offers <span className="text-xs font-normal text-gray-500">(optional)</span></h3>
          <button type="button"
            onClick={() => set('packs', [...f.packs, { qty: f.packs.length ? Number(f.packs[f.packs.length - 1].qty) + 1 : 2, price: '', badge: { en: '', ar: '' } }])}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"><Plus size={16} /> Add pack</button>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          The normal price is "1 pack" automatically. Enter the <b>total price</b> for 2, 3… units. Customers always get the cheapest mix of packs.
          Packs do not apply to a variant that has its own price.
        </p>
        {f.packs.map((x, i) => {
          const full = base * (Number(x.qty) || 0)
          const save = full - (Number(x.price) || 0)
          return (
            <div key={i} className="mb-3 rounded-xl border p-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="block"><span className="mb-1 block text-xs font-medium">Units in pack</span>
                  <input type="number" min="2" max="20" className={inputCls} value={x.qty} onChange={(e) => setPack(i, { qty: e.target.value })} /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium">Total price (QAR)</span>
                  <input type="number" min="0" step="0.01" className={inputCls} value={x.price} onChange={(e) => setPack(i, { price: e.target.value })} /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium">Badge (English)</span>
                  <input className={inputCls} placeholder="Most popular" value={x.badge.en} onChange={(e) => setPack(i, { badge: { ...x.badge, en: e.target.value } })} /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium">Badge (Arabic)</span>
                  <input dir="rtl" className={inputCls} placeholder="الأكثر طلبًا" value={x.badge.ar} onChange={(e) => setPack(i, { badge: { ...x.badge, ar: e.target.value } })} /></label>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {full > 0 && x.price !== ''
                    ? `Without offer: ${money(full)} · ${save > 0 ? `customer saves ${money(Math.round(save * 100) / 100)}` : 'no saving, check the price'}`
                    : 'Set the product price above to see the saving'}
                </span>
                <button type="button" onClick={() => set('packs', f.packs.filter((_, j) => j !== i))}
                  className="flex items-center gap-1 text-red-600 hover:underline"><Trash2 size={14} /> Remove</button>
              </div>
            </div>
          )
        })}
      </section>

      <section className="rounded-2xl bg-gray-50 p-4">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={gift.enabled} onChange={(e) => setGift({ enabled: e.target.checked })} />
          Free gift: buy this product, get another one free
        </label>
        {gift.enabled && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-3"><span className="mb-1 block text-xs font-medium">Free product</span>
              <select className={inputCls} value={gift.product} onChange={(e) => setGift({ product: e.target.value })}>
                <option value="">Choose a product…</option>
                {candidates.map((p) => <option key={p._id} value={p._id}>{p.name.en} (stock {p.stock})</option>)}
              </select>
            </label>
            <label className="block"><span className="mb-1 block text-xs font-medium">Customer must buy (units)</span>
              <input type="number" min="1" className={inputCls} value={gift.minQty} onChange={(e) => setGift({ minQty: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium">Free units they get</span>
              <input type="number" min="1" className={inputCls} value={gift.qty} onChange={(e) => setGift({ qty: e.target.value })} /></label>
            <p className="self-end text-xs text-gray-500 sm:col-span-3">
              The gift is added to the order automatically, taken from its stock, and your cost for it counts in profit.
              Only products without variants can be gifts. If the gift runs out, the offer is hidden and orders still go through.
            </p>
          </div>
        )}
      </section>
    </>
  )
}