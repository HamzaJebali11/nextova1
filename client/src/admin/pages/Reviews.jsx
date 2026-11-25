import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'
import { fmtDate } from '../../lib/constants'
import { Stars, StarInput } from '../../store/components/Stars'
import { FilterChip, ListTable, PageHeader, Pager, SearchBox, SidePanel, Tag, Th, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']]
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

function AddReview({ products, onAdded }) {
  const blank = { productId: '', name: '', rating: 0, title: '', comment: '', orderNumber: '' }
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
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-lg bg-gray-100 p-3 text-sm text-ink">
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Order number (optional)</span>
          <input className={`${inputCls} w-44 font-mono`} placeholder="NX-1023" value={f.orderNumber}
            onChange={(e) => set('orderNumber', e.target.value.toUpperCase())} />
          <span className="mt-1 block max-w-xs text-xs text-gray-500">
            Shown as “Verified buyer” only when linked to a real order that contains this product.
          </span>
        </label>
        <button disabled={uploading} className="rounded-lg bg-accent px-5 py-2 font-bold text-white hover:bg-accent-hover disabled:opacity-60">Save review</button>
      </div>
    </form>
  )
}

const TONE = { pending: 'ink', approved: 'outline', rejected: 'danger' }

export default function Reviews() {
  const [tab, setTab] = useState('pending')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [data, setData] = useState({ items: [], pages: 1, total: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page })
    if (tab) params.set('status', tab)
    setLoading(true)
    try {
      setData(await api(`/reviews/admin/all?${params}`))
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    let cancelled = false
    api('/products/admin/all?limit=100')
      .then((d) => { if (!cancelled) setProducts(d.items) })
      .catch((error) => console.error('Failed to load all products:', error))
    return () => { cancelled = true }
  }, [])

  async function setStatus(r, status) {
    try {
      await api(`/reviews/${r._id}/status`, { method: 'PATCH', body: { status } })
      if (open?._id === r._id) setOpen({ ...open, status })
      load()
    } catch (e) { alert(e.message) }
  }

  async function remove(r) {
    if (!confirm('Delete this review?')) return
    try {
      await api(`/reviews/${r._id}`, { method: 'DELETE' })
      setOpen(null)
      load()
    } catch (e) { alert(e.message) }
  }

  // search inside the loaded page (name, product, title, comment)
  const needle = q.trim().toLowerCase()
  const rows = needle
    ? data.items.filter((r) => [r.name, r.product?.name?.en, r.title, r.comment].some((x) => (x || '').toLowerCase().includes(needle)))
    : data.items

  const actions = (r) => (
    <div className="flex flex-wrap gap-2">
      {r.status !== 'approved' && <button onClick={() => setStatus(r, 'approved')} className={btn.dark}>Approve</button>}
      {r.status !== 'rejected' && <button onClick={() => setStatus(r, 'rejected')} className={btn.ghost}>Reject</button>}
      <button onClick={() => remove(r)} className={btn.danger}><Trash2 size={14} /> Delete</button>
    </div>
  )

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Approve what customers send, and add real feedback they gave you elsewhere."
        actions={<button onClick={() => setAdding(true)} className={btn.dark}>Add a real customer review</button>} />

      <Toolbar>
        {TABS.map(([value, label]) => (
          <FilterChip key={value} active={tab === value} onClick={() => { setTab(value); setPage(1) }}
            count={value === 'pending' ? data.pending : 0} alert={value === 'pending'}>
            {label}
          </FilterChip>
        ))}
        <SearchBox value={q} onChange={setQ} placeholder="Name, product or text" className="w-full md:ms-auto md:w-64" />
      </Toolbar>

      <ListTable colSpan={6} loading={loading && data.items.length === 0} empty={rows.length === 0 && 'No reviews here.'} minWidth="56rem"
        head={<><Th>Rating</Th><Th>Customer</Th><Th>Product</Th><Th>Review</Th><Th>Status</Th><Th end>Actions</Th></>}>
        {rows.map((r) => (
          <tr key={r._id} onClick={() => setOpen(r)} className="cursor-pointer align-top hover:bg-gray-50">
            <td className="p-3"><Stars value={r.rating} size={14} /></td>
            <td className="p-3">
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-gray-500">{fmtDate(r.createdAt)} · {r.source}{r.order?.orderNumber ? ` · order ${r.order.orderNumber}` : ''}</div>
            </td>
            <td className="p-3 text-gray-700">{r.product?.name?.en || '–'}</td>
            <td className="max-w-[22rem] p-3">
              {r.title && <div className="font-medium">{r.title}</div>}
              <div className="line-clamp-2 text-gray-600">{r.comment}</div>
              {r.images?.length > 0 && <div className="mt-1 text-xs text-gray-500">{r.images.length} photo(s)</div>}
            </td>
            <td className="p-3"><Tag tone={TONE[r.status]}>{r.status}</Tag></td>
            <td className="p-3" onClick={(e) => e.stopPropagation()}><div className="flex justify-end">{actions(r)}</div></td>
          </tr>
        ))}
      </ListTable>

      <Pager page={page} pages={data.pages} total={data.total} label="review(s)" onPage={setPage} />

      <AnimatePresence>
        {open && (
          <SidePanel key={open._id} title={open.name} onClose={() => setOpen(null)}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Stars value={open.rating} /> <Tag tone={TONE[open.status]}>{open.status}</Tag>
              {open.order?.orderNumber && <Tag tone="soft">Verified buyer · {open.order.orderNumber}</Tag>}
            </div>
            <div className="mb-1 text-sm text-gray-500">{open.product?.name?.en} · {fmtDate(open.createdAt)} · {open.source}</div>
            {open.title && <div className="mt-3 font-semibold">{open.title}</div>}
            {open.comment && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{open.comment}</p>}
            {open.images?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {open.images.map((im) => (
                  <a key={im.url} href={im.url} target="_blank" rel="noreferrer">
                    <img src={optimizeImg(im.url, 240)} alt="" className="h-24 w-24 rounded-xl object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-5">{actions(open)}</div>
          </SidePanel>
        )}
        {adding && (
          <SidePanel key="add" title="Add a real customer review" onClose={() => setAdding(false)}>
            <AddReview products={products} onAdded={() => { setAdding(false); load() }} />
          </SidePanel>
        )}
      </AnimatePresence>
    </div>
  )
}
