import { useCallback, useEffect, useState } from 'react'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'
import { fmtDate } from '../../lib/constants'
import { Stars, StarInput } from '../../store/components/Stars'

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']]
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

function AddReview({ products, onAdded }) {
  const blank = { productId: '', name: '', rating: 0, title: '', comment: '', verified: false }
  const [f, setF] = useState(blank)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  async function addFiles(e) {
    const files = [...e.target.files].slice(0, 3 - images.length)
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const up = []
      for (const file of files) up.push(await uploadImage(file))
      setImages((s) => [...s, ...up].slice(0, 3))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!f.productId || f.name.trim().length < 2 || !f.rating) {
      setError('Choose a product, enter the customer name, and pick a rating.')
      return
    }
    try {
      await api('/reviews/admin', { method: 'POST', body: { ...f, name: f.name.trim(), images } })
      setF(blank)
      setImages([])
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        Only add real feedback that real customers sent you (for example on WhatsApp or Messenger), and ask for their permission first.
        Do not write reviews yourself: it misleads customers and can get your ads rejected.
      </p>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <select className={inputCls} value={f.productId} onChange={(e) => set('productId', e.target.value)}>
          <option value="">Choose product…</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name.en}</option>)}
        </select>
        <input className={inputCls} placeholder="Customer name" value={f.name} onChange={(e) => set('name', e.target.value)} />
      </div>

      <StarInput value={f.rating} onChange={(v) => set('rating', v)} size={26} />
      <input className={inputCls} placeholder="Title (optional)" value={f.title} onChange={(e) => set('title', e.target.value)} />
      <textarea rows={3} className={inputCls} placeholder="What the customer said" value={f.comment} onChange={(e) => set('comment', e.target.value)} />

      <div className="flex flex-wrap items-center gap-3">
        {images.map((im, i) => (
          <div key={im.url} className="relative">
            <img src={optimizeImg(im.url, 160)} alt="" className="h-16 w-16 rounded-xl object-cover" />
            <button type="button" onClick={() => setImages((s) => s.filter((_, j) => j !== i))}
              className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-900 text-white"><X size={12} /></button>
          </div>
        ))}
        {images.length < 3 && (
          <label className="flex h-16 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-4 text-sm text-gray-600 hover:border-gray-900">
            {uploading ? 'Uploading…' : <><ImagePlus size={18} /> Add photos</>}
            <input type="file" accept="image/*" multiple hidden onChange={addFiles} disabled={uploading} />
          </label>
        )}
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.verified} onChange={(e) => set('verified', e.target.checked)} />
          Mark as verified buyer (only if you know they bought it)
        </label>
        <button disabled={uploading} className="rounded-lg bg-gray-900 px-5 py-2 text-white hover:bg-gray-700 disabled:opacity-60">Add review</button>
      </div>
    </form>
  )
}

export default function Reviews() {
  const [tab, setTab] = useState('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], pages: 1, total: 0, pending: 0 })
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page })
    if (tab) params.set('status', tab)
    setData(await api(`/reviews/admin/all?${params}`))
  }, [tab, page])

  useEffect(() => {
  let cancelled = false

  const fetchData = async () => {
    try {
      await load()
    } catch (error) {
      if (!cancelled) {
        console.error('Failed to load products:', error)
      }
    }
  }

  fetchData()

  return () => {
    cancelled = true
  }
}, [load])

useEffect(() => {
  let cancelled = false

  const fetchProducts = async () => {
    try {
      const data = await api('/products/admin/all?limit=100')

      if (!cancelled) {
        setProducts(data.items)
      }
    } catch (error) {
      if (!cancelled) {
        console.error('Failed to load all products:', error)
      }
    }
  }

  fetchProducts()

  return () => {
    cancelled = true
  }
}, [])

  async function setStatus(id, status) {
    try { await api(`/reviews/${id}/status`, { method: 'PATCH', body: { status } }); load() } catch (e) { alert(e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this review?')) return
    try { await api(`/reviews/${id}`, { method: 'DELETE' }); load() } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">
          {showForm ? 'Close' : 'Add a real customer review'}
        </button>
      </div>

      {showForm && <AddReview products={products} onAdded={() => { setShowForm(false); load() }} />}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <button key={value} onClick={() => { setTab(value); setPage(1) }}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === value ? 'bg-gray-900 text-white' : 'border bg-white hover:bg-gray-100'}`}>
            {label}{value === 'pending' && data.pending > 0 ? ` (${data.pending})` : ''}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {data.items.length === 0 && <div className="p-6 text-gray-500">No reviews here.</div>}
        <ul className="divide-y">
          {data.items.map((r) => (
            <li key={r._id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Stars value={r.rating} />
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-gray-400">{fmtDate(r.createdAt)} · {r.source}{r.verified ? ' · verified' : ''}</span>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  r.status === 'approved' ? 'bg-green-100 text-green-700'
                  : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">{r.product?.name?.en}</div>
              {r.title && <div className="mt-2 font-medium">{r.title}</div>}
              {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{r.comment}</p>}
              {r.images?.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {r.images.map((im) => (
                    <a key={im.url} href={im.url} target="_blank" rel="noreferrer">
                      <img src={optimizeImg(im.url, 160)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {r.status !== 'approved' && <button onClick={() => setStatus(r._id, 'approved')} className="rounded-lg bg-green-600 px-3 py-1.5 text-white hover:bg-green-700">Approve</button>}
                {r.status !== 'rejected' && <button onClick={() => setStatus(r._id, 'rejected')} className="rounded-lg border px-3 py-1.5 hover:bg-gray-100">Reject</button>}
                <button onClick={() => remove(r._id)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /> Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>{data.total} review(s)</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span>{page} / {data.pages || 1}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )
}