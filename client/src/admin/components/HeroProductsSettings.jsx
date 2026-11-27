import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'

// Settings: "Hero products" (home page first screen). Only changes the form; nothing is saved until Save.
// Auto: up to 5 visible in-stock products, best sellers first, then newest.
// Choose myself: up to 5 products in your order (hidden or sold-out ones are skipped on the shop;
// if none of them can be shown, the shop uses the automatic list).
export const MAX_HERO = 5
const inputCls = 'w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

export default function HeroProductsSettings({ hero, onChange }) {
  const mode = hero?.mode === 'manual' ? 'manual' : 'auto'
  const chosen = (hero?.products || []).map(String)
  const [catalog, setCatalog] = useState([])
  const [q, setQ] = useState('')
  const [pickId, setPickId] = useState('')

  useEffect(() => {
    let cancelled = false
    api('/products/admin/all?limit=100').then((d) => { if (!cancelled) setCatalog(d.items || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const byId = useMemo(() => new Map(catalog.map((p) => [String(p._id), p])), [catalog])
  const set = (patch) => onChange({ mode, products: chosen, seconds: hero?.seconds ?? 3, ...patch })
  const move = (i, dir) => { const l = [...chosen]; [l[i], l[i + dir]] = [l[i + dir], l[i]]; set({ products: l }) }
  const options = catalog.filter((p) => !chosen.includes(String(p._id)))
    .filter((p) => !q.trim() || `${p.name?.en} ${p.name?.ar} ${p.sku || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const note = (p) => (!p ? 'not found' : !p.isActive ? 'hidden: skipped on the shop' : (p.stock || 0) <= 0 ? 'sold out: skipped on the shop' : '')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="heroMode" checked={mode === 'auto'} onChange={() => set({ mode: 'auto' })} /> Auto (best sellers first, then newest)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="heroMode" checked={mode === 'manual'} onChange={() => set({ mode: 'manual' })} /> Choose myself
        </label>
      </div>

      {mode === 'manual' && (
        <div className="space-y-2">
          <ol className="space-y-2">
            {chosen.map((id, i) => {
              const p = byId.get(id)
              return (
                <li key={id} className="flex items-center gap-2 rounded-xl border bg-gray-50 p-2 text-sm">
                  <span className="w-5 text-center text-xs text-gray-500">{i + 1}</span>
                  {p?.images?.[0]?.url
                    ? <img src={optimizeImg(p.images[0].url, 80)} alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />
                    : <span className="h-9 w-9 rounded-lg bg-gray-200" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p?.name?.en || id}</span>
                    {note(p) && <span className="block text-xs text-amber-700">{note(p)}</span>}
                  </span>
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"
                    className="rounded-lg border bg-white p-1.5 hover:bg-gray-100 disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button type="button" disabled={i === chosen.length - 1} onClick={() => move(i, 1)} aria-label="Move down"
                    className="rounded-lg border bg-white p-1.5 hover:bg-gray-100 disabled:opacity-30"><ArrowDown size={15} /></button>
                  <button type="button" onClick={() => set({ products: chosen.filter((x) => x !== id) })} aria-label="Remove from the hero"
                    className="rounded-lg border bg-white p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                </li>
              )
            })}
          </ol>
          {chosen.length === 0 && <p className="text-xs text-gray-500">No product chosen yet: the shop uses the automatic list.</p>}
          {chosen.length < MAX_HERO ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block min-w-40 flex-1">
                <span className="mb-1 block text-xs font-medium">Find a product</span>
                <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or SKU" />
              </label>
              <label className="block min-w-48 flex-[2]">
                <span className="mb-1 block text-xs font-medium">Product</span>
                <select className={inputCls} value={pickId} onChange={(e) => setPickId(e.target.value)}>
                  <option value="">Choose…</option>
                  {options.map((p) => (
                    <option key={p._id} value={p._id}>{p.name?.en}{!p.isActive ? ' (hidden)' : (p.stock || 0) <= 0 ? ' (sold out)' : ''}</option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={!pickId} onClick={() => { set({ products: [...chosen, pickId] }); setPickId('') }}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40">
                <Plus size={15} /> Add
              </button>
            </div>
          ) : <p className="text-xs text-gray-500">5 products chosen (the most the hero shows).</p>}
        </div>
      )}

      <label className="block w-44">
        <span className="mb-1 block text-xs font-medium">Seconds per product</span>
        <input type="number" min="2" max="10" className={inputCls} value={hero?.seconds ?? 3}
          onChange={(e) => set({ seconds: e.target.value })} />
      </label>
    </div>
  )
}
