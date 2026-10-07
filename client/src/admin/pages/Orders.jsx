import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Phone, X } from 'lucide-react'
import { api } from '../../lib/api'
import { STATUSES, money, fmtDate } from '../../lib/constants'
import StatusBadge from '../components/StatusBadge'
import ReceiptPanel from '../components/ReceiptPanel'
import CostsPanel from '../components/CostsPanel'
function Drawer({ order, onClose, onChanged }) {
  const [note, setNote] = useState(order.adminNotes || '')
  const [busy, setBusy] = useState(false)
  const c = order.customer
  const wa = `https://wa.me/${c.phone.replace('+', '')}?text=${encodeURIComponent(
    `Hello ${c.name}, this is Nextova about your order ${order.orderNumber}.`
  )}`

  async function changeStatus(status) {
    setBusy(true)
    try {
      onChanged(await api(`/orders/${order._id}/status`, { method: 'PATCH', body: { status } }))
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    try {
      onChanged(await api(`/orders/${order._id}/notes`, { method: 'PATCH', body: { adminNotes: note } }))
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{order.orderNumber}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="mb-1"><StatusBadge status={order.status} /></div>
        <div className="mb-5 text-xs text-gray-500">{fmtDate(order.createdAt)} · {order.source}</div>
           {(order.utm?.source || order.utm?.campaign) && (
  <div className="mb-5 text-xs text-gray-500">
    Ad: {[order.utm.source, order.utm.medium, order.utm.campaign].filter(Boolean).join(' / ')}
  </div>
)}
        <section className="mb-5 rounded-xl bg-gray-50 p-4 text-sm">
          <div className="font-semibold">{c.name}</div>
          <div className="text-gray-600">{c.phone}</div>
          <div className="mt-2 text-gray-600">{[c.area, c.address].filter(Boolean).join(' · ')}</div>
          {c.notes && <div className="mt-2 italic text-gray-500">"{c.notes}"</div>}
          <div className="mt-3 flex gap-2">
            <a href={wa} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a href={`tel:${c.phone}`}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-100">
              <Phone size={16} /> Call
            </a>
          </div>
        </section>
        <ReceiptPanel order={order} />
        <CostsPanel order={order} onChanged={onChanged} />
        <section className="mb-5">
          <h3 className="mb-2 font-semibold">Items</h3>
          <ul className="divide-y text-sm">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                {it.image && <img src={it.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <div className="flex-1">
                  <div className="font-medium">{it.name}</div>
                  {it.variantName && <div className="text-xs text-gray-500">{it.variantName}</div>}
                </div>
                <div className="text-right">{it.qty} × {money(it.price)}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span>{money(order.deliveryFee)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total (cash on delivery)</span><span>{money(order.total)}</span></div>
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 font-semibold">Change status</h3>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s.value} disabled={busy || s.value === order.status}
                onClick={() => changeStatus(s.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  s.value === order.status ? 'bg-gray-900 text-white' : 'border hover:bg-gray-100'
                } disabled:opacity-60`}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Cancelling or returning an order puts its items back in stock.</p>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 font-semibold">Private notes</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            className="w-full rounded-lg border p-2 text-sm outline-none focus:ring-2 focus:ring-gray-900" />
          <button onClick={saveNote} className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">
            Save note
          </button>
        </section>

        <section>
          <h3 className="mb-2 font-semibold">History</h3>
          <ul className="space-y-1 text-xs text-gray-600">
            {[...order.statusHistory].reverse().map((h, i) => (
              <li key={i}>{fmtDate(h.at)} · <b>{h.status}</b>{h.note ? ` · ${h.note}` : ''}</li>
            ))}
          </ul>
        </section>
      </motion.aside>
    </motion.div>
  )
}

export default function Orders() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page })
    if (status) params.set('status', status)
    if (q.trim()) params.set('q', q.trim())
    try {
      setData(await api(`/orders?${params}`))
    } finally {
      setLoading(false)
    }
  }, [status, q, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  function onChanged(updated) {
    setSelected(updated)
    setData((d) => ({ ...d, items: d.items.map((o) => (o._id === updated._id ? updated : o)) }))
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Orders</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: '', label: 'All' }, ...STATUSES].map((s) => (
          <button key={s.value} onClick={() => { setStatus(s.value); setPage(1) }}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              status === s.value ? 'bg-gray-900 text-white' : 'border bg-white hover:bg-gray-100'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
        placeholder="Search by order number, name or phone…"
        className="mb-4 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900 md:max-w-md" />

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {loading && data.items.length === 0 && <div className="p-6 text-gray-500">Loading…</div>}
        {!loading && data.items.length === 0 && <div className="p-6 text-gray-500">No orders found.</div>}
        <ul className="divide-y">
          {data.items.map((o) => (
            <motion.li key={o._id} layout whileHover={{ backgroundColor: '#f9fafb' }}
              onClick={() => setSelected(o)}
              className="flex cursor-pointer items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-semibold">{o.orderNumber} · {o.customer.name}</div>
                <div className="truncate text-sm text-gray-500">
                  {o.customer.phone} · {o.items.length} item(s) · {fmtDate(o.createdAt)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold">{money(o.total)}</div>
                <StatusBadge status={o.status} />
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>{data.total} order(s)</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span>{page} / {data.pages || 1}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}
            className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>

      <AnimatePresence>
        {selected && <Drawer key={selected._id} order={selected} onClose={() => setSelected(null)} onChanged={onChanged} />}
      </AnimatePresence>
    </div>
  )
}