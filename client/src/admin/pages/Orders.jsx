import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Download, MapPin, Phone, Printer, Search, SlidersHorizontal, Truck, X } from 'lucide-react'
import { api } from '../../lib/api'
import { downloadFile } from '../../lib/download'
import { addressParts } from '../../lib/address'
import { STATUSES, FAIL_REASONS, money, fmtDate, fmtDay, reasonLabel } from '../../lib/constants'
import StatusBadge from '../components/StatusBadge'
import ReceiptPanel from '../components/ReceiptPanel'
import CostsPanel from '../components/CostsPanel'
import { WhatsAppState, LocationState } from '../components/OrderBadges'
import { WhatsAppIcon } from '../../store/components/icons'
import { FilterMenu, MenuOption, ProductPicker, ActiveChip } from '../components/FilterMenu'
import { useDialogFocus } from '../../lib/useDialogFocus'
import { FlagChips, FailureChip, FailedDialog } from '../components/OrderFlags'
import { waDigits } from '../../lib/phone'
import { openPrint } from '../../lib/print'

const itemsSummary = (o) =>
  o.items
    .filter((i) => i.price > 0)
    .map((i) => `${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`)
    .join('  ·  ')

const waLink = (o) =>
  `https://wa.me/${waDigits(o.customer.phone)}?text=${encodeURIComponent(
    `Hello ${o.customer.name}, this is Nextova about your order ${o.orderNumber}.`
  )}`

// ad attribution: names come from the ad URL parameters (campaign = utm_campaign, ad set = utm_term, ad = utm_content)
const adOf = (o) => {
  const a = o.attribution || {}
  return {
    source: [a.source || o.utm?.source, a.medium || o.utm?.medium].filter(Boolean).join(' / '),
    campaign: a.campaign || o.utm?.campaign, campaignId: a.campaignId,
    adset: a.term, adsetId: a.adsetId,
    ad: a.content, adId: a.adId,
  }
}

function AdCell({ order }) {
  const a = adOf(order)
  const angle = order.angle?.slug && (
    <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">angle: {order.angle.slug}</span>
  )
  if (!a.campaign && !a.campaignId && !a.ad && !a.adId) {
    return <div className="text-xs text-gray-500">{a.source || (order.source === 'website' ? 'No ad' : '–')}{angle && <div>{angle}</div>}</div>
  }
  return (
    <div className="text-xs">
      <div className="font-medium text-gray-800">{a.ad || (a.adId ? `Ad ${a.adId}` : 'Ad: –')}</div>
      <div className="text-gray-500">{a.campaign || a.campaignId}</div>
      {angle && <div>{angle}</div>}
    </div>
  )
}

function Attribution({ order }) {
  const a = adOf(order)
  const raw = order.attribution || {}
  const row = (label, name, id) => (name || id) && (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-end font-medium">
        {name || '–'}
        {id && <span className="ms-1 font-mono text-xs text-gray-500">#{id}</span>}
      </dd>
    </div>
  )
  const has = a.source || a.campaign || a.campaignId || a.ad || a.adId || order.angle?.slug || order.event?.name
  return (
    <section className="mb-5 rounded-xl border p-4 text-sm">
      <h3 className="mb-1 font-semibold">Where this order came from</h3>
      {!has && (
        <p className="text-gray-500">
          {order.source === 'website' ? 'No ad data (direct visit, or an order placed before ad tracking).' : `Registered by hand (${order.source}).`}
        </p>
      )}
      {has && (
        <dl className="divide-y">
          {row('Source', a.source)}
          {row('Campaign', a.campaign, a.campaignId)}
          {row('Ad set', a.adset, a.adsetId)}
          {row('Ad', a.ad, a.adId)}
          {row('Ad angle page', order.angle?.slug)}
          {row('Sales event', order.event?.name)}
          {row('Landing page', raw.landing)}
          {row('Came from site', raw.referrer)}
          {raw.firstSeenAt && row('First visit', fmtDate(raw.firstSeenAt))}
        </dl>
      )}
      {(raw.fbclid || raw.fbp || raw.fbc || raw.ttclid) && (
        <details className="mt-2 text-xs text-gray-600">
          <summary className="cursor-pointer">Click IDs and cookies</summary>
          <div className="mt-1 space-y-1 break-all font-mono">
            {raw.fbclid && <div>fbclid (a click id, not an ad id): {raw.fbclid}</div>}
            {raw.fbc && <div>_fbc: {raw.fbc}</div>}
            {raw.fbp && <div>_fbp: {raw.fbp}</div>}
            {raw.ttclid && <div>ttclid: {raw.ttclid}</div>}
          </div>
        </details>
      )}
    </section>
  )
}

// Qatar (UTC+3) calendar helpers
const qToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
const qWeekStart = () => {
  const d = new Date(`${qToday()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) // Monday
  return d.toISOString().slice(0, 10)
}

// ---------------- side panel with the full order ----------------

// the other orders of this phone number, with block / unblock
function PhoneHistory({ order }) {
  const key = String(order.customer?.phone || '').replace(/\D/g, '').slice(-8)
  const [data, setData] = useState(null)
  const [blockNote, setBlockNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (key.length !== 8) return
    let cancelled = false
    api(`/customers/${key}`).then((d) => { if (!cancelled) setData(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [key])
  if (key.length !== 8) return null

  async function setBlocked(blocked) {
    setBusy(true)
    try {
      const meta = await api(`/customers/${key}`, { method: 'PATCH', body: { blocked, blockNote: blocked ? blockNote.trim() : '' } })
      setData((d) => ({ ...d, meta }))
      setBlockNote('')
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const others = (data?.orders || []).filter((o) => o._id !== order._id)
  const s = data?.summary
  return (
    <section className="mb-5 rounded-xl border p-4 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">This phone number</h3>
        <Link to={`/admin/customers?open=${key}`} className="text-xs underline">Open customer</Link>
      </div>
      {!data && <p className="text-gray-500">Loading…</p>}
      {s && (
        <p className="mb-2 text-gray-600">
          {s.orders} order{s.orders === 1 ? '' : 's'} · {s.delivered} delivered · <span className={s.failed ? 'font-semibold text-red-700' : ''}>{s.failed} failed</span> · {s.cancelled} cancelled · spent {money(s.spent)}
        </p>
      )}
      {others.length > 0 && (
        <ul className="mb-3 divide-y rounded-lg border">
          {others.slice(0, 8).map((o) => (
            <li key={o._id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
              <span className="font-medium">{o.orderNumber}</span>
              <span className="text-xs text-gray-500">{fmtDay(o.createdAt)}</span>
              <StatusBadge status={o.status} />
              {o.failure?.reason && <span className="text-xs text-gray-600">{reasonLabel(o.failure.reason)}</span>}
              <span className="ms-auto text-xs">{money(o.total)}</span>
            </li>
          ))}
        </ul>
      )}
      {data && others.length === 0 && <p className="mb-3 text-gray-500">No other order from this number.</p>}
      {data?.meta?.blocked ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2">
          <Ban size={15} className="text-red-700" aria-hidden="true" />
          <span className="text-red-800">Blocked{data.meta.blockNote ? `: ${data.meta.blockNote}` : ''}</span>
          <button disabled={busy} onClick={() => setBlocked(false)} className="ms-auto rounded-lg border bg-white px-3 py-1 text-xs hover:bg-gray-100">Unblock</button>
        </div>
      ) : data && (
        <div className="flex gap-2">
          <input value={blockNote} onChange={(e) => setBlockNote(e.target.value)} maxLength={300} placeholder="Note (why block?)"
            aria-label="Block note" className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gray-900" />
          <button disabled={busy} onClick={() => setBlocked(true)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"><Ban size={13} /> Block this phone</button>
        </div>
      )}
    </section>
  )
}

function Drawer({ order, onClose, onChanged }) {
  const [note, setNote] = useState(order.adminNotes || '')
  const [busy, setBusy] = useState(false)
  const [failOpen, setFailOpen] = useState(false)
  const c = order.customer
  const parts = addressParts(c)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function changeStatus(status) {
    if (status === 'returned') return setFailOpen(true) // a failed delivery needs a reason
    setBusy(true)
    try {
      onChanged(await api(`/orders/${order._id}/status`, { method: 'PATCH', body: { status } }))
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function markFailed(body) {
    onChanged(await api(`/orders/${order._id}/status`, { method: 'PATCH', body: { status: 'returned', ...body } }))
    setFailOpen(false)
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
      <motion.aside onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Order ${order.orderNumber}`}
        className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{order.orderNumber}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <FailureChip failure={order.failure} />
          <FlagChips flags={order.flags} held={order.flags?.held && order.status === 'on_hold'} />
          <WhatsAppState order={order} />
          <LocationState order={order} />
        </div>
        <div className="mb-3 text-xs text-gray-500">{fmtDate(order.createdAt)} · {order.source}</div>
        {order.failure?.reason && (
          <div className="mb-3 rounded-xl bg-gray-50 p-3 text-sm">
            <b>Failed delivery: {reasonLabel(order.failure.reason)}</b>
            {order.failure.note && <div className="text-gray-700">{order.failure.note}</div>}
            <div className="text-xs text-gray-500">{order.failure.at && fmtDate(order.failure.at)}{order.failure.by ? ` · by ${order.failure.by}` : ''} · {order.failure.restocked ? 'units returned to stock' : 'units NOT returned to stock'}</div>
          </div>
        )}
        <div className="mb-5 flex flex-wrap gap-2">
          <button onClick={() => openPrint([order._id], 'slips')} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100"><Printer size={15} /> Packing slip</button>
          <button onClick={() => openPrint([order._id], 'labels')} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100"><Printer size={15} /> Label</button>
        </div>

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
            <a href={waLink(order)} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 font-semibold text-white hover:brightness-110">
              <WhatsAppIcon size={16} /> WhatsApp customer
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
                    <div className="mt-0.5 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-ink">
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
                  s.value === order.status ? `${s.color} ring-2 ring-current` : 'border hover:bg-gray-100'
                } disabled:opacity-60`}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Cancelling an order puts its items back in stock. "Failed / returned" asks for the reason and whether to return the units.</p>
        </section>

        <PhoneHistory order={order} />

        <Attribution order={order} />
        <ReceiptPanel order={order} />
        <CostsPanel order={order} onChanged={onChanged} />

        <section className="mb-5">
          <h3 className="mb-2 font-semibold">Private notes</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            className="w-full rounded-lg border p-2 text-sm outline-none focus:ring-2 focus:ring-gray-900" />
          <button onClick={saveNote} className="mt-2 rounded-lg px-4 py-2 text-sm bg-accent font-bold text-white hover:bg-accent-hover">
            Save note
          </button>
        </section>

        <section>
          <h3 className="mb-2 font-semibold">History</h3>
          <ul className="space-y-1 text-xs text-gray-600">
            {[...order.statusHistory].reverse().map((h, i) => (
              <li key={i}>{fmtDate(h.at)} · <b>{h.status}</b>{h.note ? ` · ${h.note}` : ''}{h.by ? ` · ${h.by}` : ''}</li>
            ))}
          </ul>
        </section>
      </motion.aside>
      <AnimatePresence>
        {failOpen && <FailedDialog title={`Delivery failed: ${order.orderNumber}`} onCancel={() => setFailOpen(false)} onConfirm={markFailed} />}
      </AnimatePresence>
    </motion.div>
  )
}

// ---------------- list ----------------

export default function Orders() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [zone, setZone] = useState('')
  const [source, setSource] = useState('')
  const [adFilter, setAdFilter] = useState('') // "c:<campaign>" or "a:<ad>"
  const [adOptions, setAdOptions] = useState({ campaigns: [], ads: [] })
  const [angleFilter, setAngleFilter] = useState('')
  const [eventFilter, setEventFilter] = useState(() => new URLSearchParams(window.location.search).get('event') || '')
  const [events, setEvents] = useState([])
  const [angleOptions, setAngleOptions] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [product, setProduct] = useState(null) // { id, name, image } of the chosen product
  const [reasonFilter, setReasonFilter] = useState('') // failed reason ('any' = every failed order with a reason)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [bulkFail, setBulkFail] = useState(false)
  const [prodOpts, setProdOpts] = useState({ key: null, list: [] })
  const [needOpts, setNeedOpts] = useState(false) // the product list is only loaded once the filter is opened
  const [panelOpen, setPanelOpen] = useState(false) // "Filters" panel on narrow screens
  const panelRef = useRef(null)
  useDialogFocus(panelRef, panelOpen)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], pages: 1, total: 0 })
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [bulkStatus, setBulkStatus] = useState('confirmed')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  // dates are Qatar time (UTC+3)
  const fromIso = from ? new Date(`${from}T00:00:00+03:00`).toISOString() : ''
  const toIso = to ? new Date(`${to}T23:59:59.999+03:00`).toISOString() : ''

  // the filters as URL parameters (shared by the list, the product counts and the Excel export)
  const filterParams = useCallback(({ searchKey = 'q', skipProduct = false } = {}) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (q.trim()) params.set(searchKey, q.trim())
    if (zone.trim()) params.set('zone', zone.trim())
    if (source) params.set('source', source)
    if (adFilter.startsWith('c:')) params.set('campaign', adFilter.slice(2))
    if (adFilter.startsWith('a:')) params.set('ad', adFilter.slice(2))
    if (angleFilter) params.set('angle', angleFilter)
    if (eventFilter) params.set('event', eventFilter)
    if (fromIso) params.set('from', fromIso)
    if (toIso) params.set('to', toIso)
    if (product && !skipProduct) params.set('product', product.id)
    if (reasonFilter) params.set('reason', reasonFilter)
    if (flaggedOnly) params.set('flagged', '1')
    return params
  }, [status, q, zone, source, adFilter, angleFilter, eventFilter, fromIso, toIso, product, reasonFilter, flaggedOnly])

  const load = useCallback(async () => {
    setLoading(true)
    const params = filterParams()
    params.set('page', page)
    params.set('limit', 30)
    try {
      setData(await api(`/orders?${params}`))
    } finally {
      setLoading(false)
    }
  }, [filterParams, page])

  // products for the Product filter, with their number of orders under the other filters
  const optsKey = filterParams({ skipProduct: true }).toString()
  useEffect(() => {
    if (!needOpts) return
    let cancelled = false
    const t = setTimeout(() => {
      api(`/orders/product-options?${optsKey}`)
        .then((list) => { if (!cancelled) setProdOpts({ key: optsKey, list }) })
        .catch(() => {})
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [needOpts, optsKey])
  const optsLoading = prodOpts.key !== optsKey

  useEffect(() => {
    api('/events').then((list) => setEvents(list.filter((e) => e.orders > 0 || e.status === 'live'))).catch(() => {})
  }, [])

  useEffect(() => {
    api('/orders/by-angle?days=90')
      .then((d) => setAngleOptions([...new Set(d.rows.map((r) => r.slug).filter(Boolean))]))
      .catch(() => {})
  }, [])

  // campaigns and ads seen in the last 90 days, for the filter
  useEffect(() => {
    api('/orders/by-ad?days=90').then((d) => {
      const campaigns = new Map()
      const ads = new Map()
      for (const r of d.rows) {
        const c = r.campaignId || r.campaign
        if (c) campaigns.set(c, r.campaign ? `${r.campaign}${r.campaignId ? ` (#${r.campaignId})` : ''}` : `#${r.campaignId}`)
        const a = r.adId || r.ad
        if (a) ads.set(a, r.ad ? `${r.ad}${r.adId ? ` (#${r.adId})` : ''}` : `#${r.adId}`)
      }
      setAdOptions({ campaigns: [...campaigns], ads: [...ads] })
    }).catch(() => {})
  }, [])

  const loadCounts = useCallback(() => {
    api('/orders/stats')
      .then((d) => setCounts(Object.fromEntries(d.byStatus.map((b) => [b._id, b.count]))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => { loadCounts() }, [loadCounts])

  // opened from a "new order" notification: /admin/orders?open=<id>
  const [params, setParams] = useSearchParams()
  const openId = params.get('open')
  useEffect(() => {
    if (!openId) return
    let cancelled = false
    api(`/orders/${openId}`)
      .then((o) => { if (!cancelled) setSelected(o) })
      .catch(() => {})
      .finally(() => {
        const next = new URLSearchParams(params)
        next.delete('open')
        setParams(next, { replace: true })
      })
    return () => { cancelled = true }
  }, [openId]) // eslint-disable-line react-hooks/exhaustive-deps

  function onChanged(updated) {
    setSelected(updated)
    setData((d) => ({ ...d, items: d.items.map((o) => (o._id === updated._id ? updated : o)) }))
    loadCounts()
  }

  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); setPicked(new Set()) }

  function quickRange(kind) {
    setPage(1)
    setPicked(new Set())
    if (kind === 'today') { setFrom(qToday()); setTo(qToday()) }
    else if (kind === 'week') { setFrom(qWeekStart()); setTo(qToday()) }
    else { setFrom(''); setTo('') }
  }
  const range = !from && !to ? 'all' : from === qToday() && to === qToday() ? 'today' : from === qWeekStart() && to === qToday() ? 'week' : 'custom'

  // selection
  const pageIds = data.items.map((o) => o._id)
  const allPicked = pageIds.length > 0 && pageIds.every((id) => picked.has(id))
  const toggle = (id) => setPicked((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const toggleAll = () => setPicked((s) => {
    const n = new Set(s)
    if (allPicked) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id))
    return n
  })

  async function applyBulk(extra) {
    // "Failed / returned" first asks for one reason for all the ticked orders
    if (bulkStatus === 'returned' && !extra) return setBulkFail(true)
    const label = STATUSES.find((s) => s.value === bulkStatus)?.label
    if (!extra && !confirm(`Change ${picked.size} order(s) to "${label}"?`)) return
    setBulkBusy(true)
    try {
      const r = await api('/orders/bulk-status', { method: 'PATCH', body: { ids: [...picked], status: bulkStatus, ...(extra || {}) } })
      setBulkFail(false)
      alert(`${r.changed} order(s) changed${r.skipped ? `, ${r.skipped} already had that status` : ''}${r.failed?.length ? `. Not changed: ${r.failed.join(' · ')}` : ''}.`)
      setPicked(new Set())
      await load()
      loadCounts()
    } catch (e) {
      alert(e.message)
    } finally {
      setBulkBusy(false)
    }
  }

  async function exportExcel(onlyPicked = false) {
    setExporting(true)
    try {
      const params = onlyPicked ? new URLSearchParams({ ids: [...picked].join(',') }) : filterParams({ searchKey: 'search' })
      const name = onlyPicked
        ? `orders-selected-${qToday()}.xlsx`
        : `orders-${status || 'all'}${zone.trim() ? `-zone${zone.trim()}` : ''}${product ? '-product' : ''}-${qToday()}.xlsx`
      await downloadFile(`/exports/orders.xlsx?${params}`, name)
    } catch (e) {
      alert(e.message)
    } finally {
      setExporting(false)
    }
  }

  const box = 'h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-gray-900'
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const pickF = (fn) => (v) => { fn(v); setPage(1); setPicked(new Set()) }
  const noop = () => {}

  const statusLabel = STATUSES.find((s) => s.value === status)?.label
  const sourceLabel = { website: 'Website', other: 'WhatsApp / manual' }[source]
  const rangeLabel = range === 'all' ? '' : range === 'today' ? 'Today' : range === 'week' ? 'This week' : `${from || '…'} → ${to || '…'}`
  const adLabel = adFilter && (adOptions.campaigns.concat(adOptions.ads).find(([v]) => v === adFilter.slice(2))?.[1] || adFilter.slice(2))
  const eventLabel = eventFilter && (events.find((e) => e._id === eventFilter)?.name?.en || 'Sales event')
  const hasMore = true // the failed reason and "Flagged" filters are always there
  const moreCount = [adFilter, angleFilter, eventFilter, reasonFilter, flaggedOnly].filter(Boolean).length

  // active filters, shown as removable chips under the bar
  const active = [
    q.trim() && { key: 'q', label: `Search: ${q.trim()}`, clear: () => pickF(setQ)('') },
    status && { key: 'status', label: `Status: ${statusLabel}`, clear: () => pickF(setStatus)('') },
    zone.trim() && { key: 'zone', label: `Zone ${zone.trim()}`, clear: () => pickF(setZone)('') },
    product && { key: 'product', label: `Product: ${product.name}`, clear: () => pickF(setProduct)(null) },
    source && { key: 'source', label: `Source: ${sourceLabel}`, clear: () => pickF(setSource)('') },
    range !== 'all' && { key: 'date', label: `Date: ${rangeLabel}`, clear: () => quickRange('all') },
    adFilter && { key: 'ad', label: `${adFilter.startsWith('c:') ? 'Campaign' : 'Ad'}: ${adLabel}`, clear: () => pickF(setAdFilter)('') },
    angleFilter && { key: 'angle', label: angleFilter === 'none' ? 'No angle' : `Angle: ${angleFilter}`, clear: () => pickF(setAngleFilter)('') },
    eventFilter && { key: 'event', label: `Event: ${eventLabel}`, clear: () => pickF(setEventFilter)('') },
    reasonFilter && { key: 'reason', label: reasonFilter === 'any' ? 'Failed: any reason' : `Failed: ${reasonLabel(reasonFilter)}`, clear: () => pickF(setReasonFilter)('') },
    flaggedOnly && { key: 'flagged', label: 'Flagged only', clear: () => pickF(setFlaggedOnly)(false) },
  ].filter(Boolean)
  const filterCount = active.filter((f) => f.key !== 'q').length

  function clearAll() {
    setFrom(''); setTo(''); setZone(''); setSource(''); setAdFilter(''); setAngleFilter(''); setEventFilter('')
    setQ(''); setStatus(''); setProduct(null); setReasonFilter(''); setFlaggedOnly(false); setPage(1); setPicked(new Set())
  }

  // the content of each filter (used in the dropdowns, and in the "Filters" panel on narrow screens)
  const statusBody = (close) => (
    <div>
      <MenuOption selected={!status} count={allCount} onClick={() => { pickF(setStatus)(''); close() }}>All statuses</MenuOption>
      {STATUSES.map((s) => (
        <MenuOption key={s.value} selected={status === s.value} count={counts[s.value]} alert={s.value === 'new'}
          onClick={() => { pickF(setStatus)(s.value); close() }}>{s.label}</MenuOption>
      ))}
    </div>
  )
  const zoneBody = (close, autoFocus = true) => (
    <form onSubmit={(e) => { e.preventDefault(); close() }} className="p-1">
      <input autoFocus={autoFocus} value={zone} onChange={reset(setZone)} placeholder="Zone no., e.g. 55" inputMode="numeric"
        aria-label="Zone number" className={`${box} w-full`} />
      <p className="mt-1.5 text-xs text-gray-500">Orders delivered to this zone number.</p>
    </form>
  )
  const productBody = (close, autoFocus = true) => (
    <ProductPicker options={prodOpts.list} loading={optsLoading} value={product?.id || ''} autoFocus={autoFocus}
      onPick={(o) => { pickF(setProduct)(o ? { id: o.id, name: o.name, image: o.image } : null); close() }} />
  )
  const sourceBody = (close) => (
    <div>
      {[['', 'All sources'], ['website', 'Website'], ['other', 'WhatsApp / manual']].map(([v, l]) => (
        <MenuOption key={v || 'all'} selected={source === v} onClick={() => { pickF(setSource)(v); close() }}>{l}</MenuOption>
      ))}
    </div>
  )
  const dateBody = (close) => (
    <div>
      {[['all', 'All time'], ['today', 'Today'], ['week', 'This week']].map(([k, l]) => (
        <MenuOption key={k} selected={range === k} onClick={() => { quickRange(k); close() }}>{l}</MenuOption>
      ))}
      <div className="mt-2 grid grid-cols-2 gap-2 border-t px-1 pt-2">
        <label className="text-xs text-gray-600">From
          <input type="date" value={from} onChange={reset(setFrom)} className={`${box} mt-1 w-full px-2`} />
        </label>
        <label className="text-xs text-gray-600">To
          <input type="date" value={to} onChange={reset(setTo)} className={`${box} mt-1 w-full px-2`} />
        </label>
      </div>
    </div>
  )
  const moreBody = () => (
    <div className="space-y-3 p-1">
      <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm">
        <input type="checkbox" checked={flaggedOnly} onChange={(e) => pickF(setFlaggedOnly)(e.target.checked)} />
        Flagged only <span className="text-xs text-gray-500">(failed before, duplicate, blocked)</span>
      </label>
      <label className="block text-xs text-gray-600">Failed delivery reason
        <select value={reasonFilter} onChange={reset(setReasonFilter)} className={`${box} mt-1 w-full`}>
          <option value="">Any order</option>
          <option value="any">Failed, any reason</option>
          {FAIL_REASONS.map((r) => <option key={r.value} value={r.value}>Failed: {r.label}</option>)}
        </select>
      </label>
      {(adOptions.campaigns.length > 0 || adOptions.ads.length > 0 || adFilter) && (
        <label className="block text-xs text-gray-600">Campaign or ad
          <select value={adFilter} onChange={reset(setAdFilter)} className={`${box} mt-1 w-full`}>
            <option value="">All campaigns and ads</option>
            {adOptions.campaigns.length > 0 && (
              <optgroup label="Campaign">
                {adOptions.campaigns.map(([v, l]) => <option key={`c${v}`} value={`c:${v}`}>{l}</option>)}
              </optgroup>
            )}
            {adOptions.ads.length > 0 && (
              <optgroup label="Ad">
                {adOptions.ads.map(([v, l]) => <option key={`a${v}`} value={`a:${v}`}>{l}</option>)}
              </optgroup>
            )}
          </select>
        </label>
      )}
      {(angleOptions.length > 0 || angleFilter) && (
        <label className="block text-xs text-gray-600">Ad angle
          <select value={angleFilter} onChange={reset(setAngleFilter)} className={`${box} mt-1 w-full`}>
            <option value="">All angles</option>
            <option value="none">No angle</option>
            {angleOptions.map((s) => <option key={s} value={s}>angle: {s}</option>)}
          </select>
        </label>
      )}
      {(events.length > 0 || eventFilter) && (
        <label className="block text-xs text-gray-600">Sales event
          <select value={eventFilter} onChange={reset(setEventFilter)} className={`${box} mt-1 w-full`}>
            <option value="">All sales events</option>
            {events.map((e) => <option key={e._id} value={e._id}>{e.name?.en} ({e.startDate})</option>)}
          </select>
        </label>
      )}
    </div>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-gray-500">Click an order to open it; tick orders to change or export several at once.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/delivery" className="flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold hover:bg-gray-100">
            <Truck size={16} /> Delivery sheet
          </Link>
          <button onClick={() => exportExcel(false)} disabled={exporting}
            className="flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
            <Download size={16} /> {exporting ? 'Preparing…' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {/* Filter bar: search, then the filters as compact dropdowns (one "Filters" button on narrow screens) */}
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1 xl:max-w-xs">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input value={q} onChange={reset(setQ)} placeholder="Name, phone or order no." aria-label="Search orders"
            className={`${box} w-full ps-9`} />
        </label>
        <div className="hidden items-center gap-2 xl:flex">
          <FilterMenu label="Status" value={statusLabel} active={!!status} badge={status ? 0 : counts.new} width="w-60">
            {({ close }) => statusBody(close)}
          </FilterMenu>
          <FilterMenu label="Zone" value={zone.trim()} active={!!zone.trim()} width="w-56">
            {({ close }) => zoneBody(close)}
          </FilterMenu>
          <FilterMenu label="Product" value={product?.name} active={!!product} width="w-80" onOpen={() => setNeedOpts(true)}>
            {({ close }) => productBody(close)}
          </FilterMenu>
          <FilterMenu label="Source" value={sourceLabel} active={!!source} width="w-56">
            {({ close }) => sourceBody(close)}
          </FilterMenu>
          <FilterMenu label="Date" value={rangeLabel} active={range !== 'all'} width="w-72" align={hasMore ? 'start' : 'end'}>
            {({ close }) => dateBody(close)}
          </FilterMenu>
          {hasMore && (
            <FilterMenu label="More" value={moreCount ? String(moreCount) : ''} active={moreCount > 0} width="w-72" align="end">
              {() => moreBody()}
            </FilterMenu>
          )}
        </div>
        <button type="button" onClick={() => { setPanelOpen(true); setNeedOpts(true) }} aria-haspopup="dialog"
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium xl:hidden ${filterCount ? 'border-ink bg-ink text-white' : 'bg-white hover:bg-gray-100'}`}>
          <SlidersHorizontal size={16} aria-hidden="true" /> Filters
          {filterCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs font-bold">{filterCount}</span>}
          {!filterCount && counts.new > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{counts.new}</span>}
        </button>
      </div>

      {/* result count + active filters */}
      <div className="mb-4 mt-3 flex min-h-8 flex-wrap items-center gap-2" aria-live="polite">
        <span className="me-1 text-sm text-gray-600"><b className="text-ink">{data.total}</b> order{data.total === 1 ? '' : 's'}</span>
        {active.map((f) => <ActiveChip key={f.key} onRemove={f.clear}>{f.label}</ActiveChip>)}
        {active.length > 1 && (
          <button type="button" onClick={clearAll} className="min-h-8 px-1 text-sm text-gray-600 underline hover:text-ink">Clear all</button>
        )}
      </div>

      {/* narrow screens: all filters in one panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanelOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setPanelOpen(false)}>
            <motion.div ref={panelRef} role="dialog" aria-modal="true" aria-label="Filters" onClick={(e) => e.stopPropagation()}
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: 'tween', duration: 0.2 }}
              className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-lg font-bold">Filters</h2>
                <button onClick={() => setPanelOpen(false)} aria-label="Close filters" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-gray-100"><X size={18} /></button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
                <section><h3 className="mb-1 text-sm font-semibold">Status</h3>{statusBody(noop)}</section>
                <section><h3 className="mb-1 text-sm font-semibold">Zone</h3>{zoneBody(noop, false)}</section>
                <section><h3 className="mb-1 text-sm font-semibold">Product</h3>{productBody(noop, false)}</section>
                <section><h3 className="mb-1 text-sm font-semibold">Source</h3>{sourceBody(noop)}</section>
                <section><h3 className="mb-1 text-sm font-semibold">Date</h3>{dateBody(noop)}</section>
                {hasMore && <section><h3 className="mb-1 text-sm font-semibold">More</h3>{moreBody()}</section>}
              </div>
              <div className="flex items-center gap-3 border-t px-4 py-3">
                {active.length > 0 && <button type="button" onClick={clearAll} className="min-h-11 text-sm underline">Clear all</button>}
                <button type="button" onClick={() => setPanelOpen(false)}
                  className="ms-auto h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:bg-gray-800">
                  Show {data.total} order{data.total === 1 ? '' : 's'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk actions */}
      <AnimatePresence>
        {picked.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white">
            <b>{picked.size} selected</b>
            <span className="mx-1 opacity-50">|</span>
            <label className="flex items-center gap-2">Change status to
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
                className="rounded-lg bg-white px-2 py-1.5 text-ink">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <button onClick={() => applyBulk()} disabled={bulkBusy}
              className="rounded-lg bg-white px-3 py-1.5 font-bold text-ink hover:bg-gray-100 disabled:opacity-60">
              {bulkBusy ? 'Saving…' : 'Apply'}
            </button>
            <button onClick={() => exportExcel(true)} disabled={exporting}
              className="flex items-center gap-1 rounded-lg border border-paper/40 px-3 py-1.5 hover:bg-white/10">
              <Download size={14} /> Export selected
            </button>
            <button onClick={() => openPrint(picked, 'slips')} className="flex items-center gap-1 rounded-lg border border-paper/40 px-3 py-1.5 hover:bg-white/10">
              <Printer size={14} /> Print packing slips
            </button>
            <button onClick={() => openPrint(picked, 'labels')} className="flex items-center gap-1 rounded-lg border border-paper/40 px-3 py-1.5 hover:bg-white/10">
              <Printer size={14} /> Print labels
            </button>
            <button onClick={() => setPicked(new Set())} className="ms-auto underline">Clear selection</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table with sticky header */}
      <div className="max-h-[70vh] overflow-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-gray-200)]">
            <tr className="text-xs text-gray-500">
              <th className="w-10 p-3 text-start">
                <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all orders on this page" />
              </th>
              <th className="p-3 text-start">Order</th>
              <th className="p-3 text-start">Customer</th>
              <th className="p-3 text-start">Area</th>
              <th className="p-3 text-start">Items</th>
              <th className="p-3 text-start">Ad</th>
              <th className="p-3 text-end">Total</th>
              <th className="p-3 text-start">Status</th>
              <th className="p-3 text-end"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && data.items.length === 0 && [0, 1, 2, 3, 4].map((i) => (
              <tr key={i} className="animate-pulse">
                <td colSpan={9} className="p-3"><div className="h-10 rounded bg-gray-100" /></td>
              </tr>
            ))}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500">No orders found.</td></tr>
            )}
            {data.items.map((o) => (
              <tr key={o._id} onClick={() => setSelected(o)}
                className={`cursor-pointer align-top transition hover:bg-gray-50 ${picked.has(o._id) ? 'bg-gray-100' : ''}`}>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={picked.has(o._id)} onChange={() => toggle(o._id)} aria-label={`Select ${o.orderNumber}`} />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {o.status === 'new' && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="New" />}
                    {o.orderNumber}
                  </div>
                  <div className="text-xs text-gray-500">{fmtDate(o.createdAt)}</div>
                  {o.source && o.source !== 'website' && (
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{o.source}</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-medium">{o.customer.name}</div>
                  <div className="text-xs text-gray-500" dir="ltr">{o.customer.phone}</div>
                </td>
                <td className="p-3 text-gray-700">
                  {o.customer.area}
                  {o.customer.zone && <div className="text-xs text-gray-500">Zone {o.customer.zone}</div>}
                </td>
                <td className="max-w-[16rem] p-3">
                  <div className="line-clamp-2 text-gray-800">{itemsSummary(o)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <FailureChip failure={o.failure} />
                    <FlagChips flags={o.flags} />
                    <WhatsAppState order={o} />
                    <LocationState order={o} />
                  </div>
                </td>
                <td className="max-w-[12rem] p-3"><AdCell order={o} /></td>
                <td className="p-3 text-end font-semibold">{money(o.total)}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="p-3 text-end" onClick={(e) => e.stopPropagation()}>
                  <a href={waLink(o)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${o.customer.name}`}
                    title="WhatsApp customer"
                    className="inline-grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white hover:brightness-110">
                    <WhatsAppIcon size={18} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <AnimatePresence>
        {bulkFail && <FailedDialog count={picked.size} onCancel={() => setBulkFail(false)} onConfirm={(body) => applyBulk(body)} />}
      </AnimatePresence>
    </div>
  )
}
