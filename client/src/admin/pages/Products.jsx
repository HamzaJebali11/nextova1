import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { money } from '../../lib/constants'
import ProductForm from '../components/ProductForm'

const r2 = (n) => Math.round(n * 100) / 100

function QuickNumber({ value, onSave, disabled, label }) {
  return (
    <input
      key={value}
      type="number"
      min="0"
      disabled={disabled}
      defaultValue={value}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const n = Number(e.target.value)
        if (e.target.value !== '' && n !== Number(value)) onSave(n)
        else e.target.value = value
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-20 rounded-lg border bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100"
    />
  )
}

// on / off switch for "visible in the store"
function ActiveSwitch({ on, onChange, name }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={`${name}: visible in the store`} onClick={onChange}
      className="flex items-center gap-2 text-xs font-medium">
      <span className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-ink' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'start-[1.375rem]' : 'start-0.5'}`} />
      </span>
      <span className={on ? 'text-ink' : 'text-gray-500'}>{on ? 'Active' : 'Hidden'}</span>
    </button>
  )
}

export default function Products() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], pages: 1, total: 0 })
  const [cats, setCats] = useState([])
  const [form, setForm] = useState(null) // null = closed, 'new' = add, product = edit
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: 20 })
    if (q.trim()) params.set('q', q.trim())
    if (category) params.set('category', category)
    if (lowOnly) params.set('lowStock', 'true')
    try {
      setData(await api(`/products/admin/all?${params}`))
    } finally {
      setLoading(false)
    }
  }, [q, category, lowOnly, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    api('/categories/admin/all').then(setCats).catch(() => {})
  }, [])

  async function patch(p, body, endpoint = '') {
    try {
      const updated = await api(`/products/${p._id}${endpoint}`, { method: endpoint ? 'PATCH' : 'PUT', body })
      setData((d) => ({ ...d, items: d.items.map((x) => (x._id === p._id ? { ...x, ...updated } : x)) }))
    } catch (e) {
      alert(e.message)
      load()
    }
  }

  async function remove(p) {
    if (!confirm(`Delete "${p.name.en}"? Old orders keep their saved copy.`)) return
    try {
      await api(`/products/${p._id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const box = 'min-h-10 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <button onClick={() => setForm('new')}
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">
          <Plus size={18} /> Add product
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative w-full md:max-w-sm">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label="Search products"
            placeholder="Search by name or SKU…" className={`${box} w-full ps-9`} />
        </label>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} aria-label="Category" className={box}>
          <option value="">All categories</option>
          <option value="none">No category</option>
          {cats.map((c) => <option key={c._id} value={c._id}>{c.name?.en}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1) }} />
          Low stock only
        </label>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="p-3 text-start">Product</th>
              <th className="p-3 text-start">Price</th>
              <th className="p-3 text-end">Base cost</th>
              <th className="p-3 text-end" title="Base cost + product ad spend ÷ units purchased">Real cost / unit</th>
              <th className="p-3 text-end">Profit / unit</th>
              <th className="p-3 text-start">Stock</th>
              <th className="p-3 text-end">Units sold</th>
              <th className="p-3 text-start">Status</th>
              <th className="p-3 text-end"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && data.items.length === 0 && [0, 1, 2, 3].map((i) => (
              <tr key={i} className="animate-pulse"><td colSpan={9} className="p-3"><div className="h-12 rounded bg-gray-100" /></td></tr>
            ))}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500">No products found.</td></tr>
            )}
            {data.items.map((p) => {
              const hasVariants = p.variants?.length > 0
              const profit = r2((Number(p.price) || 0) - (p.realCost ?? p.costPrice ?? 0))
              const low = p.stock <= (p.lowStockAlert ?? 5)
              return (
                <tr key={p._id} className={`align-middle ${p.isActive ? '' : 'bg-gray-50/60'}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img src={optimizeImg(p.images?.[0]?.url, 120)} alt=""
                        className="h-12 w-12 shrink-0 rounded-xl bg-gray-100 object-cover" />
                      <div className="min-w-0">
                        <button type="button" onClick={() => setForm(p)} className="text-start font-semibold hover:underline">
                          {p.name.en}
                        </button>
                        <div className="text-xs text-gray-500">
                          {p.category?.name?.en || 'No category'}
                          {hasVariants && ` · ${p.variants.length} variants`}
                          {p.isFeatured && ' · Featured'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <QuickNumber value={p.price} label={`Price of ${p.name.en}`} onSave={(n) => patch(p, { price: n })} />
                      {p.compareAtPrice > p.price && <s className="text-xs text-gray-500">{p.compareAtPrice}</s>}
                    </div>
                  </td>
                  <td className="p-3 text-end">{money(p.baseCost ?? p.costPrice ?? 0)}</td>
                  <td className="p-3 text-end">
                    <b>{money(p.realCost ?? p.costPrice ?? 0)}</b>
                    {p.adPerUnit > 0 && <div className="text-[11px] text-gray-500">+{money(p.adPerUnit)} ads</div>}
                    {p.needsUnits && <div className="text-[11px] font-semibold text-red-600">Set units purchased</div>}
                  </td>
                  <td className={`p-3 text-end font-semibold ${profit < 0 ? 'text-red-700' : 'text-ink'}`}>
                    {money(profit)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <QuickNumber value={p.stock} disabled={hasVariants} label={`Stock of ${p.name.en}`}
                        onSave={(n) => patch(p, { stock: n }, '/stock')} />
                      {low && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${p.stock <= 0 ? 'text-red-700' : 'text-ink'}`}>
                          <AlertTriangle size={14} aria-hidden="true" /> {p.stock <= 0 ? 'Sold out' : 'Low'}
                        </span>
                      )}
                    </div>
                    {hasVariants && <div className="mt-0.5 text-[11px] text-gray-500">Edit stock per variant</div>}
                  </td>
                  <td className="p-3 text-end">{p.soldCount || 0}</td>
                  <td className="p-3">
                    <ActiveSwitch on={p.isActive} name={p.name.en} onChange={() => patch(p, { isActive: !p.isActive })} />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setForm(p)} className="rounded-lg p-2 hover:bg-gray-100" title="Edit" aria-label={`Edit ${p.name.en}`}><Pencil size={18} /></button>
                      <button onClick={() => remove(p)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Delete" aria-label={`Delete ${p.name.en}`}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Real cost / unit = base cost + (all ad spend linked to the product ÷ units purchased). Profit / unit is at the normal price, before shipping.
      </p>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>{data.total} product(s)</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span>{page} / {data.pages || 1}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>

      <AnimatePresence>
        {form && (
          <ProductForm
            key={form === 'new' ? 'new' : form._id}
            product={form === 'new' ? null : form}
            categories={cats}
            onClose={() => setForm(null)}
            onSaved={() => { setForm(null); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
