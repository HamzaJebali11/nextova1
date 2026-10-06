import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import ProductForm from '../components/ProductForm'

function QuickNumber({ value, onSave, disabled }) {
  return (
    <input
      key={value}
      type="number"
      min="0"
      disabled={disabled}
      defaultValue={value}
      onBlur={(e) => {
        const n = Number(e.target.value)
        if (e.target.value !== '' && n !== Number(value)) onSave(n)
        else e.target.value = value
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-20 rounded-lg border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100"
    />
  )
}

export default function Products() {
  const [q, setQ] = useState('')
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
    if (lowOnly) params.set('lowStock', 'true')
    try {
      setData(await api(`/products/admin/all?${params}`))
    } finally {
      setLoading(false)
    }
  }, [q, lowOnly, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    api('/categories/admin/all').then(setCats).catch(() => {})
  }, [])

  async function patch(p, body, endpoint = '') {
    try {
      const updated = await api(`/products/${p._id}${endpoint}`, {
        method: endpoint ? 'PATCH' : 'PUT',
        body,
      })
      setData((d) => ({
        ...d,
        items: d.items.map((x) => (x._id === p._id ? { ...x, ...updated, category: x.category } : x)),
      }))
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
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
          placeholder="Search by name or SKU…"
          className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900 md:max-w-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1) }} />
          Low stock only
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {loading && data.items.length === 0 && <div className="p-6 text-gray-500">Loading…</div>}
        {!loading && data.items.length === 0 && <div className="p-6 text-gray-500">No products found.</div>}
        <ul className="divide-y">
          {data.items.map((p) => {
            const hasVariants = p.variants?.length > 0
            return (
              <motion.li key={p._id} layout className="flex flex-wrap items-center gap-4 p-4">
                <img src={optimizeImg(p.images?.[0]?.url, 120)} alt=""
                  className="h-16 w-16 rounded-xl bg-gray-100 object-cover" />
                <div className="min-w-0 flex-1 basis-48">
                  <div className="font-semibold">{p.name.en}</div>
                  <div className="text-xs text-gray-500">
                    {p.category?.name?.en || 'No category'}
                    {hasVariants && ` · ${p.variants.length} variants`}
                    {p.isFeatured && ' · Featured'}
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  <div className="mb-1">Price</div>
                  <div className="flex items-center gap-2">
                    <QuickNumber value={p.price} onSave={(n) => patch(p, { price: n })} />
                    {p.compareAtPrice > p.price && <s className="text-gray-400">{p.compareAtPrice}</s>}
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  <div className="mb-1">Stock</div>
                  <QuickNumber value={p.stock} disabled={hasVariants}
                    onSave={(n) => patch(p, { stock: n }, '/stock')} />
                </div>

                <button onClick={() => patch(p, { isActive: !p.isActive })}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                  {p.isActive ? 'Visible' : 'Hidden'}
                </button>

                <div className="flex gap-1">
                  <button onClick={() => setForm(p)} className="rounded-lg p-2 hover:bg-gray-100" title="Edit"><Pencil size={18} /></button>
                  <button onClick={() => remove(p)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={18} /></button>
                </div>
              </motion.li>
            )
          })}
        </ul>
      </div>

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