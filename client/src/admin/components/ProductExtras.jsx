import { Plus, Trash2 } from 'lucide-react'
import { money } from '../../lib/constants'

const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

const r2 = (n) => Math.round(n * 100) / 100

// adSpendTotal: all ad spend linked to this product (from Ads & costs), defaultUnits: stock + sold
export default function ProductExtras({ f, set, adSpendTotal = 0, defaultUnits = 0 }) {
  const price = Number(f.price) || 0
  const cost = Number(f.costPrice) || 0
  const units = Number(f.unitsPurchased) > 0 ? Number(f.unitsPurchased) : defaultUnits
  const adPerUnit = units > 0 ? adSpendTotal / units : 0
  const realCost = r2(cost + adPerUnit)
  const unit = price - realCost
  const margin = price > 0 ? Math.round((unit / price) * 100) : 0

  const setFaq = (i, key, lang, v) =>
    set('faqs', f.faqs.map((x, j) => (j === i ? { ...x, [key]: { ...x[key], [lang]: v } } : x)))
  const setRow = (i, key, lang, v) =>
    set('comparison', f.comparison.map((x, j) => (j === i ? { ...x, [key]: { ...x[key], [lang]: v } } : x)))

  return (
    <>
      <section className="rounded-2xl bg-gray-50 p-4">
        <h3 className="mb-2 font-semibold">Cost and profit <span className="text-xs font-normal text-gray-500">(private, customers never see this)</span></h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Base cost per unit (QAR)</span>
            <input type="number" min="0" step="0.01" className={inputCls} value={f.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
            <span className="mt-1 block text-xs text-gray-500">What one unit costs you to buy. It is not changed by ads.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Units purchased (ads cost is spread over these)</span>
            <input type="number" min="0" step="1" className={inputCls} value={f.unitsPurchased}
              placeholder={String(defaultUnits)} onChange={(e) => set('unitsPurchased', e.target.value)} />
            <span className="mt-1 block text-xs text-gray-500">
              Units bought for the current batch. Empty = stock + sold ({defaultUnits}).
            </span>
          </label>
        </div>

        <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-sm sm:grid-cols-4">
          <div><div className="text-xs text-gray-500">Base cost</div><b>{money(r2(cost))}</b></div>
          <div>
            <div className="text-xs text-gray-500">Ads per unit</div>
            <b>{money(r2(adPerUnit))}</b>
            <div className="text-[11px] text-gray-500">{money(r2(adSpendTotal))} ÷ {units || 0} units</div>
          </div>
          <div><div className="text-xs text-gray-500">Real cost per unit</div><b className="text-base">{money(realCost)}</b></div>
          <div>
            <div className="text-xs text-gray-500">Profit per unit</div>
            <b className={unit >= 0 ? 'text-ink' : 'text-red-600'}>{money(r2(unit))}</b> <span className="text-xs">({margin}%)</span>
          </div>
        </div>
        {adSpendTotal > 0 && units <= 0 && (
          <p className="mt-2 text-xs font-semibold text-red-600">This product has ad spend but no units: enter the units purchased.</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Real cost per unit = base cost + (all ad spend linked to this product in Ads &amp; costs ÷ units purchased).
          It updates by itself when you add, edit or delete an ads entry. Profit per unit is at the normal price, before shipping.
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">FAQ for this product <span className="text-xs font-normal text-gray-500">(empty = general FAQ shown)</span></h3>
          <button type="button" onClick={() => set('faqs', [...f.faqs, { q: { en: '', ar: '' }, a: { en: '', ar: '' } }])}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"><Plus size={16} /> Add question</button>
        </div>
        {f.faqs.map((x, i) => (
          <div key={i} className="mb-3 space-y-2 rounded-xl border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="Question (English)" value={x.q.en} onChange={(e) => setFaq(i, 'q', 'en', e.target.value)} />
              <input dir="rtl" className={inputCls} placeholder="السؤال (Arabic)" value={x.q.ar} onChange={(e) => setFaq(i, 'q', 'ar', e.target.value)} />
              <textarea rows={2} className={inputCls} placeholder="Answer (English)" value={x.a.en} onChange={(e) => setFaq(i, 'a', 'en', e.target.value)} />
              <textarea dir="rtl" rows={2} className={inputCls} placeholder="الجواب (Arabic)" value={x.a.ar} onChange={(e) => setFaq(i, 'a', 'ar', e.target.value)} />
            </div>
            <button type="button" onClick={() => set('faqs', f.faqs.filter((_, j) => j !== i))}
              className="flex items-center gap-1 text-sm text-red-600 hover:underline"><Trash2 size={14} /> Remove</button>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Why our product vs others</h3>
          <button type="button" onClick={() => set('comparison', [...f.comparison, { feature: { en: '', ar: '' }, ours: { en: '', ar: '' }, theirs: { en: '', ar: '' } }])}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"><Plus size={16} /> Add row</button>
        </div>
        <p className="mb-2 text-xs text-gray-500">Type ✓ or ✗ for a tick or cross, or a short text such as "2-year warranty". Keep every claim true.</p>
        {f.comparison.map((x, i) => (
          <div key={i} className="mb-3 space-y-2 rounded-xl border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="Feature (English)" value={x.feature.en} onChange={(e) => setRow(i, 'feature', 'en', e.target.value)} />
              <input dir="rtl" className={inputCls} placeholder="الميزة (Arabic)" value={x.feature.ar} onChange={(e) => setRow(i, 'feature', 'ar', e.target.value)} />
              <input className={inputCls} placeholder="Our product (English or ✓)" value={x.ours.en} onChange={(e) => setRow(i, 'ours', 'en', e.target.value)} />
              <input dir="rtl" className={inputCls} placeholder="منتجنا (Arabic, optional)" value={x.ours.ar} onChange={(e) => setRow(i, 'ours', 'ar', e.target.value)} />
              <input className={inputCls} placeholder="Others (English or ✗)" value={x.theirs.en} onChange={(e) => setRow(i, 'theirs', 'en', e.target.value)} />
              <input dir="rtl" className={inputCls} placeholder="الآخرون (Arabic, optional)" value={x.theirs.ar} onChange={(e) => setRow(i, 'theirs', 'ar', e.target.value)} />
            </div>
            <button type="button" onClick={() => set('comparison', f.comparison.filter((_, j) => j !== i))}
              className="flex items-center gap-1 text-sm text-red-600 hover:underline"><Trash2 size={14} /> Remove</button>
          </div>
        ))}
      </section>
    </>
  )
}