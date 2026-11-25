import { Fragment, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Clock, Download, MapPin, Phone, Printer } from 'lucide-react'
import { FailedDialog, FlagChips } from '../components/OrderFlags'
import { waDigits } from '../../lib/phone'
import { openPrint } from '../../lib/print'
import { api } from '../../lib/api'
import { downloadFile } from '../../lib/download'
import { addressParts } from '../../lib/address'
import { money, fmtDate, statusInfo } from '../../lib/constants'
import { isOverdue, productsToPrepare, routeSort, zoneKey } from '../../lib/deliveryRoute'
import { locationMessage } from '../../lib/messages'
import StatusBadge from '../components/StatusBadge'
import { WhatsAppState } from '../components/OrderBadges'
import { WhatsAppIcon } from '../../store/components/icons'
import { FilterChip, PageHeader, SearchBox, SidePanel, Tag, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'
import { FilterMenu, ProductPicker } from '../components/FilterMenu'

const OPEN = ['new', 'confirmed', 'processing', 'out_for_delivery']
const sum = (list) => list.reduce((total, o) => total + (Number(o.total) || 0), 0)
const itemsText = (o) =>
  (o.items || []).map((i) => `${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''}${i.price === 0 && !/free gift/.test(i.name) ? ' (free gift)' : ''}`)

function mapLink(order) {
  if (order.location?.url) return order.location.url
  const c = order.customer || {}
  const query = [c.address, c.area, c.zone && `Zone ${c.zone}`, 'Qatar'].filter(Boolean).join(' ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// dates are Qatar time (UTC+3)
const startOf = (d) => (d ? new Date(`${d}T00:00:00+03:00`).getTime() : null)
const endOf = (d) => (d ? new Date(`${d}T23:59:59.999+03:00`).getTime() : null)

export default function DeliverySheet() {
  const [data, setData] = useState({ open: [], deliveredToday: [] })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [store, setStore] = useState('Nextova')
  const [panel, setPanel] = useState(null)

  // filters
  const [statuses, setStatuses] = useState([]) // empty = all open statuses
  const [zones, setZones] = useState([])       // empty = all zones
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [product, setProduct] = useState(null) // { id, name } of the chosen product
  const [failFor, setFailFor] = useState(null) // order waiting for its failed reason
  const [picked, setPicked] = useState(() => new Set()) // ticked orders (print slips / labels)
  const [mode, setMode] = useState('route')    // route | oldest
  const [pinOverdue, setPinOverdue] = useState(false)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    api('/exports/delivery')
      .then((r) => {
        if (cancelled) return
        setData({ open: Array.isArray(r.open) ? r.open : [], deliveredToday: Array.isArray(r.deliveredToday) ? r.deliveredToday : [] })
        setError('')
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load delivery orders.') })
      .finally(() => { if (!cancelled) setLoaded(true) })
    api('/settings').then((s) => s.storeName && setStore(s.storeName)).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const allZones = useMemo(
    () => routeSort(data.open.filter((o) => zoneKey(o)), { now }).map(zoneKey).filter((z, i, a) => a.indexOf(z) === i),
    [data.open, now],
  )

  // every filter except the product one (the product list counts orders inside this)
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const a = startOf(from)
    const b = endOf(to)
    return data.open.filter((o) => {
      const t = new Date(o.createdAt).getTime()
      return (statuses.length === 0 || statuses.includes(o.status)) &&
        (zones.length === 0 || zones.includes(zoneKey(o))) &&
        (a === null || t >= a) && (b === null || t <= b) &&
        (!needle || [o.orderNumber, o.customer?.name, o.customer?.phone, o.customer?.area].some((x) => (x || '').toLowerCase().includes(needle)))
    })
  }, [data.open, statuses, zones, from, to, q])

  const hasProduct = (o, id) => (o.items || []).some((i) => String(i.product?._id || i.product) === id)
  const list = useMemo(
    () => routeSort(product ? base.filter((o) => hasProduct(o, product.id)) : base, { mode, pinOverdue, now }),
    [base, product, mode, pinOverdue, now],
  )

  // products in the open orders, with how many orders (under the other filters) contain each one
  const productOptions = useMemo(() => {
    const byId = new Map()
    for (const o of data.open) {
      for (const i of o.items || []) {
        const id = String(i.product?._id || i.product || '')
        if (id && !byId.has(id)) byId.set(id, { id, name: String(i.name || '').replace(/ \(free gift\)$/, ''), image: i.image || '', orders: 0 })
      }
    }
    for (const o of base) {
      for (const id of new Set((o.items || []).map((i) => String(i.product?._id || i.product || '')))) {
        if (byId.has(id)) byId.get(id).orders += 1
      }
    }
    return [...byId.values()]
  }, [data.open, base])

  const prepare = useMemo(() => productsToPrepare(list), [list])
  const totalUnits = prepare.reduce((n, p) => n + p.units, 0)
  const overdueCount = list.filter((o) => isOverdue(o, now)).length

  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  async function move(order, next, extra) {
    if (next === 'returned' && !extra) return setFailFor(order) // ask for the reason first
    setBusy(order._id)
    setError('')
    try {
      const updated = await api(`/orders/${order._id}/status`, { method: 'PATCH', body: { status: next, ...(extra || {}) } })
      if (extra) setFailFor(null)
      const merged = { ...order, status: updated.status, deliveredAt: updated.deliveredAt }
      setData((prev) => {
        if (next === 'delivered') return { open: prev.open.filter((o) => o._id !== order._id), deliveredToday: [merged, ...prev.deliveredToday] }
        if (['returned', 'cancelled'].includes(next)) return { ...prev, open: prev.open.filter((o) => o._id !== order._id) }
        return { ...prev, open: prev.open.map((o) => (o._id === order._id ? merged : o)) }
      })
      setPanel((p) => (p?._id === order._id ? (OPEN.includes(next) ? merged : null) : p))
    } catch (err) {
      setError(err.message || 'Failed to update order status.')
      if (extra) throw err
    } finally {
      setBusy('')
    }
  }
  const togglePick = (id) => setPicked((s0) => { const n = new Set(s0); if (n.has(id)) n.delete(id); else n.add(id); return n })
  // print in the order shown on the sheet (zone route / oldest first)
  const printPicked = (type) => openPrint(list.filter((o) => picked.has(o._id)).map((o) => o._id), type)

  async function exportList() {
    try {
      const params = new URLSearchParams({ status: (statuses.length ? statuses : OPEN).join(','), sort: mode })
      if (pinOverdue) params.set('pin', '1')
      if (zones.length) params.set('zone', zones.join(','))
      if (from) params.set('from', new Date(startOf(from)).toISOString())
      if (to) params.set('to', new Date(endOf(to)).toISOString())
      if (q.trim()) params.set('search', q.trim())
      if (product) params.set('product', product.id)
      await downloadFile(`/exports/orders.xlsx?${params}`, `orders-to-deliver${zones.length ? `-zone${zones.join('-')}` : ''}.xlsx`)
    } catch (err) {
      setError(err.message || 'Failed to export orders.')
    }
  }

  const askLocation = (order, lang) => {
    const phone = (order.customer?.phone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(locationMessage(order, lang, store))}`, '_blank', 'noopener')
  }

  const actions = (o) => (
    <div className="flex flex-wrap gap-2 print:hidden">
      <a href={`tel:${o.customer?.phone || ''}`} className={btn.ghost}><Phone size={14} /> Call</a>
      <a href={`https://wa.me/${waDigits(o.customer?.phone)}`} target="_blank" rel="noreferrer" className={btn.whatsapp}><WhatsAppIcon size={14} /> WhatsApp</a>
      {!o.location?.url && <button onClick={() => askLocation(o, 'ar')} className={btn.ghost}><MapPin size={14} /> Ask location (AR)</button>}
      {!o.location?.url && <button onClick={() => askLocation(o, 'en')} className={btn.ghost}><MapPin size={14} /> Ask location (EN)</button>}
      <a href={mapLink(o)} target="_blank" rel="noreferrer" className={btn.ghost}><MapPin size={14} /> {o.location?.url ? 'Customer location' : 'Search address'}</a>
      {o.status !== 'out_for_delivery' && (
        <button disabled={busy === o._id} onClick={() => move(o, 'out_for_delivery')} className={btn.ghost}>Out for delivery</button>
      )}
      <button disabled={busy === o._id} onClick={() => move(o, 'delivered')} className={btn.dark}>✓ Delivered</button>
      <button disabled={busy === o._id} onClick={() => move(o, 'returned')} className={btn.danger}>Not delivered</button>
    </div>
  )

  // rows, with a header for each zone in route order
  const rows = []
  let lastZone = null
  for (const o of list) {
    const z = zoneKey(o)
    if (mode === 'route' && z !== lastZone) {
      lastZone = z
      const inZone = list.filter((x) => zoneKey(x) === z)
      const late = inZone.filter((x) => isOverdue(x, now)).length
      rows.push(
        <div key={`zone-${z}`} className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white print:static print:break-after-avoid print:rounded-none print:border print:border-ink print:bg-white print:text-ink">
          {z ? `Zone ${z}` : 'No zone'} · {inZone.length} order(s) · {money(sum(inZone))}
          {late > 0 && <Tag tone="alert" className="ms-auto">{late} overdue</Tag>}
        </div>,
      )
    }
    const c = o.customer || {}
    const parts = addressParts(c)
    const late = isOverdue(o, now)
    rows.push(
      <article key={o._id} onClick={() => setPanel(o)}
        className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition hover:border-gray-400 print:break-inside-avoid print:rounded-none print:shadow-none ${late ? 'border-red-300' : ''}`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="checkbox" checked={picked.has(o._id)} onClick={(e) => e.stopPropagation()} onChange={() => togglePick(o._id)}
                aria-label={`Select ${o.orderNumber}`} className="h-4 w-4 print:hidden" />
              <span className="font-bold">{o.orderNumber}</span>
              <StatusBadge status={o.status} />
              <FlagChips flags={o.flags} />
              {late && <Tag tone="alert"><Clock size={12} aria-hidden="true" /> Overdue</Tag>}
            </div>
            <div className="mt-1 text-base font-semibold">{c.name}</div>
            <div className="text-xs text-gray-500" dir="ltr">{c.phone}</div>
            <div className="text-xs text-gray-500">{fmtDate(o.createdAt)}</div>
          </div>
          <div className="text-sm text-gray-700">
            <b>{c.area}</b>
            {parts.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {parts.map((p) => <span key={p} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold">{p}</span>)}
              </div>
            )}
            {c.address && <div className="mt-1">{c.address}</div>}
            {c.notes && <div className="italic text-gray-500">"{c.notes}"</div>}
          </div>
          <ul className="text-sm text-gray-700">{itemsText(o).map((line, i) => <li key={i}>• {line}</li>)}</ul>
          <div className="text-end">
            <div className="text-xs text-gray-500">Amount to collect</div>
            <div className="text-xl font-extrabold">{money(o.total)}</div>
            <div className="mt-1 flex justify-end"><WhatsAppState order={o} /></div>
          </div>
        </div>
        <div className="mt-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>{actions(o)}</div>
      </article>,
    )
  }

  return (
    <div>
      <PageHeader
        title="Delivery sheet"
        subtitle="Open orders in route order: zones by number, oldest order first inside each zone. Mark each one when you deliver it."
        actions={<>
          <button onClick={() => window.print()} className={btn.ghost}><Printer size={15} /> Print</button>
          <button onClick={exportList} className={btn.dark}><Download size={15} /> Export to Excel</button>
        </>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
        {[
          ['To deliver', list.length],
          ['To collect', money(sum(list))],
          ['Delivered today', data.deliveredToday.length],
          ['Collected today', money(sum(data.deliveredToday))],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-4 text-center shadow-sm">
            <div className="text-xl font-extrabold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Products to prepare (follows every filter below) */}
      <section className="mb-4 rounded-2xl border bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Products to prepare</h2>
          <span className="text-sm text-gray-600"><b>{list.length}</b> order(s) · <b>{totalUnits}</b> unit(s)</span>
        </div>
        {prepare.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing to prepare for these filters.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {prepare.map((p) => (
              <li key={`${p.name}|${p.variant}|${p.gift}`} className="flex items-baseline justify-between gap-3 border-b border-dashed py-1">
                <span>{p.name}{p.variant && <span className="text-gray-600"> · {p.variant}</span>}{p.gift && <span className="text-gray-600"> · free gift</span>}</span>
                <b className="whitespace-nowrap">{p.units} unit{p.units === 1 ? '' : 's'}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-gray-500">Units = quantity on each order line (a 2-pack is saved as 2 units), free gifts included.</p>
      </section>

      {/* Filters and order */}
      <Toolbar>
        <FilterChip active={mode === 'route'} onClick={() => setMode('route')}>Zone route order</FilterChip>
        <FilterChip active={mode === 'oldest'} onClick={() => setMode('oldest')}>Oldest first</FilterChip>
        <label className="ms-1 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinOverdue} onChange={(e) => setPinOverdue(e.target.checked)} disabled={mode !== 'route'} />
          Pin zones that have overdue orders to the top
        </label>
        {overdueCount > 0 && <Tag tone="alert" className="ms-auto">{overdueCount} overdue (older than 2 days)</Tag>}
      </Toolbar>
      <Toolbar>
        {OPEN.map((s) => (
          <FilterChip key={s} active={statuses.includes(s)} onClick={() => toggle(statuses, setStatuses, s)}
            count={data.open.filter((o) => o.status === s).length} alert={s === 'new'}>
            {statusInfo(s).label}
          </FilterChip>
        ))}
        <label className="flex items-center gap-1 text-sm text-gray-600">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-10 rounded-lg border bg-white px-2 text-sm" />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-10 rounded-lg border bg-white px-2 text-sm" />
        </label>
        <FilterMenu label="Product" value={product?.name} active={!!product} width="w-80">
          {({ close }) => (
            <ProductPicker options={productOptions} loading={false} value={product?.id || ''}
              onPick={(o) => { setProduct(o ? { id: o.id, name: o.name } : null); close() }} />
          )}
        </FilterMenu>
        <SearchBox value={q} onChange={setQ} placeholder="Name, phone, order no." className="w-full md:ms-auto md:w-60" />
      </Toolbar>
      {allZones.length > 0 && (
        <Toolbar>
          <span className="text-sm text-gray-600">Zones:</span>
          {allZones.map((z) => (
            <FilterChip key={z} active={zones.includes(z)} onClick={() => toggle(zones, setZones, z)}
              count={data.open.filter((o) => zoneKey(o) === z).length}>
              {z}
            </FilterChip>
          ))}
          {(zones.length > 0 || statuses.length > 0 || from || to || q || product) && (
            <button onClick={() => { setZones([]); setStatuses([]); setFrom(''); setTo(''); setQ(''); setProduct(null) }} className="text-sm text-gray-600 underline">Clear filters</button>
          )}
        </Toolbar>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm print:hidden">
        <button onClick={() => setPicked(new Set(list.map((o) => o._id)))} className={btn.ghost}>Select all shown ({list.length})</button>
        {picked.size > 0 && (
          <>
            <b className="ms-1">{picked.size} selected</b>
            <button onClick={() => printPicked('slips')} className={btn.dark}><Printer size={14} /> Print packing slips</button>
            <button onClick={() => printPicked('labels')} className={btn.dark}><Printer size={14} /> Print labels</button>
            <button onClick={() => setPicked(new Set())} className="underline">Clear selection</button>
          </>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {!loaded && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-200" />)}</div>}
      {loaded && list.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">Nothing to deliver for these filters.</div>
      )}

      <div className="space-y-3">{rows.map((r, i) => <Fragment key={i}>{r}</Fragment>)}</div>

      {data.deliveredToday.length > 0 && (
        <div className="mt-8 print:hidden">
          <button onClick={() => setShowDone((v) => !v)} className="mb-3 text-sm font-semibold text-gray-700 underline">
            {showDone ? 'Hide' : 'Show'} delivered today ({data.deliveredToday.length} · {money(sum(data.deliveredToday))})
          </button>
          {showDone && (
            <ul className="divide-y rounded-2xl border bg-white">
              {data.deliveredToday.map((o) => (
                <li key={o._id} className="flex items-center justify-between p-3 text-sm text-gray-500 line-through">
                  <span>{o.orderNumber} · {o.customer?.name} · {o.customer?.area}{o.customer?.zone ? ` · Zone ${o.customer.zone}` : ''}</span>
                  <span>{money(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AnimatePresence>
        {panel && (
          <SidePanel key={panel._id} title={panel.orderNumber} onClose={() => setPanel(null)}>
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusBadge status={panel.status} />
              {isOverdue(panel, now) && <Tag tone="alert">Overdue</Tag>}
            </div>
            <dl className="mb-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Customer</dt><dd className="font-semibold">{panel.customer?.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Phone</dt><dd dir="ltr">{panel.customer?.phone}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Area</dt><dd>{panel.customer?.area}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Address</dt><dd className="text-end">{addressParts(panel.customer || {}).join(' · ') || '–'}</dd></div>
              {panel.customer?.address && <div className="flex justify-between gap-3"><dt className="text-gray-500">Landmark</dt><dd className="text-end">{panel.customer.address}</dd></div>}
              {panel.customer?.notes && <div className="flex justify-between gap-3"><dt className="text-gray-500">Notes</dt><dd className="text-end italic">{panel.customer.notes}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Placed</dt><dd>{fmtDate(panel.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Amount to collect</dt><dd className="text-lg font-extrabold">{money(panel.total)}</dd></div>
            </dl>
            <h3 className="mb-1 font-semibold">Items</h3>
            <ul className="mb-4 text-sm">{itemsText(panel).map((l, i) => <li key={i}>• {l}</li>)}</ul>
            {actions(panel)}
          </SidePanel>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {failFor && <FailedDialog title={`Not delivered: ${failFor.orderNumber}`} onCancel={() => setFailFor(null)} onConfirm={(body) => move(failFor, 'returned', body)} />}
      </AnimatePresence>
    </div>
  )
}
