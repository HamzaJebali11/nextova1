import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, MapPin, MessageCircle, Phone, X } from 'lucide-react'
import { api } from '../../lib/api'
import { downloadFile } from '../../lib/download'
import { addressParts } from '../../lib/address'
import { STATUSES, money, fmtDate } from '../../lib/constants'
import StatusBadge from '../components/StatusBadge'
import ReceiptPanel from '../components/ReceiptPanel'
import CostsPanel from '../components/CostsPanel'
import { WhatsAppState, LocationState } from '../components/OrderBadges'

const itemsSummary = (o) =>
  o.items
    .filter((i) => i.price > 0)
    .map((i) => `${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`)
    .join('  ·  ')

function Drawer({ order, onClose, onChanged }) {
  const [note, setNote] = useState(order.adminNotes || '')
  const [busy, setBusy] = useState(false)
  const c = order.customer
  const parts = addressParts(c)
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

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <WhatsAppState order={order} />
          <LocationState order={order} />
        </div>
        <div className="mb-5 text-xs text-gray-500">{fmtDate(order.createdAt)} · {order.source}</div>
        {(order.utm?.source || order.utm?.campaign) && (
          <div className="-mt-3 mb-5 text-xs text-gray-500">
            Ad: {[order.utm.source, order.utm.medium, order.utm.campaign].filter(Boolean).join(' / ')}
          </div>
        )}

        <section className="mb-5 rounded-xl bg-gray-50 p-4 text-sm">
          <div className="font-semibold">{c.name}</div>
          <div className="text-gray-600">{c.phone}</div>
          {c.area && <div className="mt-2 font-medium text-gray-800">{c.area}</div>}
          {parts.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {parts.map((p) => (
                <span key={p} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">{p}</span>
              ))}
            </div>
          )}
          {c.address && <div className="mt-2 text-gray-600">{c.address}</div>}
          {c.notes && <div className="mt-2 italic text-gray-500">"{c.notes}"</div>}
          {order.location?.name && <div className="mt-2 text-gray-600">📍 {order.location.name}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={wa} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-100">
              <Phone size={16} /> Call
            </a>
            {order.location?.url && (
              <a href={order.location.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-100">
                <MapPin size={16} /> Open location
              </a>
            )}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 font-semibold">Items</h3>
          <ul className="divide-y text-sm">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                {it.image && <img src={it.image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                <div className="flex-1">
                  <div className="font-medium">{it.name}</div>
                  {it.variantName && (
                    <div className="mt-0.5 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      {it.variantName}
                    </div>
                  )}
                </div>
                <div className="text-right">{it.qty} × {it.price === 0 ? 'FREE' : money(it.price)}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-700"><span>Discount</span><span>− {money(order.discount)}</span></div>
            )}
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

        <ReceiptPanel order={order} />
        <CostsPanel order={order} onChanged={onChanged} />

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
  const [zone, setZone] = useState('')
  const [source, setSource] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [exporting, setExporting] = useState(false)

  // dates are Qatar time (UTC+3)
  const fromIso = from ? new Date(`${from}T00:00:00+03:00`).toISOString() : ''
  const toIso = to ? new Date(`${to}T23:59:59.999+03:00`).toISOString() : ''

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page })
    if (status) params.set('status', status)
    if (q.trim()) params.set('q', q.trim())
    if (zone.trim()) params.set('zone', zone.trim())
    if (source) params.set('source', source)
    if (from) params.set('from', new Date(`${from}T00:00:00+03:00`).toISOString())
    if (to) params.set('to', new Date(`${to}T23:59:59.999+03:00`).toISOString())
    try {
      setData(await api(`/orders?${params}`))
    } finally {
      setLoading(false)
    }
  }, [status, q, zone, source, from, to, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  function onChanged(updated) {
    setSelected(updated)
    setData((d) => ({ ...d, items: d.items.map((o) => (o._id === updated._id ? updated : o)) }))
  }

  async function exportExcel() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (q.trim()) params.set('search', q.trim())
      if (zone.trim()) params.set('zone', zone.trim())
      if (source) params.set('source', source)
      if (fromIso) params.set('from', fromIso)
      if (toIso) params.set('to', toIso)
      const name = `orders-${status || 'all'}${zone.trim() ? `-zone${zone.trim()}` : ''}-${new Date().toISOString().slice(0, 10)}.xlsx`
      await downloadFile(`/exports/orders.xlsx?${params}`, name)
    } catch (e) {
      alert(e.message)
    } finally {
      setExporting(false)
    }
  }

  const box = 'rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1) }

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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={reset(setQ)} placeholder="Order no., name or phone…" className={`${box} w-full md:w-56`} />
        <input value={zone} onChange={reset(setZone)} placeholder="Zone no." inputMode="numeric" className={`${box} w-28`} />
        <select value={source} onChange={reset(setSource)} className={box}>
          <option value="">All sources</option>
          <option value="website">Website</option>
          <option value="other">WhatsApp / manual</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-gray-600">From
          <input type="date" value={from} onChange={reset(setFrom)} className={box} />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600">To
          <input type="date" value={to} onChange={reset(setTo)} className={box} />
        </label>
        {(from || to || zone || source) && (
          <button onClick={() => { setFrom(''); setTo(''); setZone(''); setSource(''); setPage(1) }}
            className="text-sm text-gray-500 underline">Clear filters</button>
        )}
        <button onClick={exportExcel} disabled={exporting}
          className="ms-auto flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
          <Download size={16} /> {exporting ? 'Preparing…' : 'Export to Excel'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {loading && data.items.length === 0 && <div className="p-6 text-gray-500">Loading…</div>}
        {!loading && data.items.length === 0 && <div className="p-6 text-gray-500">No orders found.</div>}
        <ul className="divide-y">
          {data.items.map((o) => (
            <motion.li key={o._id} layout whileHover={{ backgroundColor: '#f9fafb' }}
              onClick={() => setSelected(o)}
              className="flex cursor-pointer items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-semibold">
                  {o.orderNumber} · {o.customer.name}
                  {o.source && o.source !== 'website' && (
                    <span className="ms-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{o.source}</span>
                  )}
                </div>
                <div className="truncate text-sm text-gray-500">
                  {o.customer.phone} · {o.customer.area}{o.customer.zone ? ` · Zone ${o.customer.zone}` : ''} · {fmtDate(o.createdAt)}
                </div>
                <div className="mt-1 text-sm text-gray-800">{itemsSummary(o)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <WhatsAppState order={o} />
                  <LocationState order={o} />
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