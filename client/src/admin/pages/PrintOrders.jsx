import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { addressParts } from '../../lib/address'
import { routeSort } from '../../lib/deliveryRoute'

// Printable packing slips (A4, 2 per page) and labels (100 x 150 mm, or A4 with 4 per page).
// Opened in a new tab from Orders / Delivery sheet; black and white; same order as the Delivery sheet
// (zone number, then oldest first).
const money = (n) => `QAR ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const day = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Qatar' })
const lines = (o) => (o.items || []).map((i) => ({
  qty: i.qty,
  text: `${i.name}${i.variantName ? ` (${i.variantName})` : ''}`,
  gift: i.price === 0,
}))
const units = (o) => (o.items || []).reduce((n, i) => n + (i.qty || 0), 0)

const PAGE_CSS = {
  slips: '@page { size: A4; margin: 10mm; }',
  labels: '@page { size: 100mm 150mm; margin: 4mm; }',
  'labels-a4': '@page { size: A4; margin: 8mm; }',
}

function Slip({ o, store }) {
  const c = o.customer || {}
  return (
    <article className="slip">
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <div className="text-xl font-extrabold">{store.storeName || 'Nextova'}</div>
          {(store.legalName || store.crNumber) && <div className="text-[11px]">{store.legalName}{store.crNumber ? ` · CR ${store.crNumber}` : ''}</div>}
        </div>
        <div className="text-end">
          <div className="text-[11px] uppercase">Packing slip</div>
          <div className="text-2xl font-extrabold">{o.orderNumber}</div>
          <div className="text-[11px]">{day(o.createdAt)}</div>
        </div>
      </header>
      <section className="mt-2 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[11px] uppercase">Customer</div>
          <div className="text-base font-bold">{c.name}</div>
          <div dir="ltr" className="font-semibold">{c.phone}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase">Deliver to</div>
          <div className="font-bold">{addressParts(c).join(' · ') || '–'}</div>
          {c.area && <div>{c.area}</div>}
          {c.address && <div>{c.address}</div>}
        </div>
      </section>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead><tr className="border-b border-black text-start text-[11px] uppercase"><th className="w-12 py-1 text-start">Qty</th><th className="py-1 text-start">Item (option)</th><th className="w-8 py-1">✓</th></tr></thead>
        <tbody>
          {lines(o).map((l, i) => (
            <tr key={i} className="border-b border-gray-400"><td className="py-1 text-lg font-bold">{l.qty}</td><td className="py-1">{l.text}{l.gift ? ' · FREE GIFT' : ''}</td><td className="py-1"><span className="inline-block h-4 w-4 border border-black" /></td></tr>
          ))}
        </tbody>
      </table>
      {c.notes && <p className="mt-2 border border-black p-1.5 text-sm"><b>Customer note:</b> {c.notes}</p>}
      <footer className="mt-auto flex items-end justify-between border-t-2 border-black pt-2">
        <div className="text-sm">{units(o)} unit{units(o) === 1 ? '' : 's'} · Cash on delivery</div>
        <div className="text-end"><div className="text-[11px] uppercase">Amount to collect</div><div className="text-2xl font-extrabold">{money(o.total)}</div></div>
      </footer>
    </article>
  )
}

function Label({ o }) {
  const c = o.customer || {}
  const short = lines(o).map((l) => `${l.qty}× ${l.text}${l.gift ? ' (gift)' : ''}`).join(', ')
  return (
    <article className="label">
      <div className="border-b-2 border-black pb-1 text-center text-[34px] font-extrabold leading-tight">{o.orderNumber}</div>
      <div className="mt-2 text-lg font-bold leading-tight">{c.name}</div>
      <div dir="ltr" className="text-lg font-semibold">{c.phone}</div>
      <div className="mt-1 text-xl font-extrabold">{addressParts(c).join(' · ') || '–'}</div>
      {(c.area || c.address) && <div className="text-sm">{[c.area, c.address].filter(Boolean).join(' · ')}</div>}
      <div className="mt-2 border-y-2 border-black py-1 text-center">
        <div className="text-[10px] uppercase">Collect in cash</div>
        <div className="text-2xl font-extrabold">{money(o.total)}</div>
      </div>
      <div className="mt-1 text-sm"><b>{units(o)} item{units(o) === 1 ? '' : 's'}:</b> {short}</div>
    </article>
  )
}

export default function PrintOrders() {
  const [params] = useSearchParams()
  const type = ['slips', 'labels', 'labels-a4'].includes(params.get('type')) ? params.get('type') : 'slips'
  const ids = params.get('ids') || ''
  const [orders, setOrders] = useState(null)
  const [store, setStore] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([api(`/orders/by-ids?ids=${encodeURIComponent(ids)}`), api('/settings/admin').catch(() => ({}))])
      .then(([list, s]) => {
        if (cancelled) return
        setOrders(routeSort(list, { mode: 'route' }))
        setStore(s || {})
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [ids])

  useEffect(() => {
    if (!orders?.length) return
    document.title = `${type === 'slips' ? 'Packing slips' : 'Labels'} (${orders.length})`
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [orders, type])

  const switchTo = (t) => { const n = new URLSearchParams(params); n.set('type', t); window.location.search = n.toString() }

  return (
    <div className={`print-root ${type}`}>
      <style>{`
        ${PAGE_CSS[type]}
        .print-root { color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; }
        .slip { display: flex; flex-direction: column; height: 136mm; box-sizing: border-box; padding: 6mm; border: 1px dashed #999; margin: 0 auto 6mm; max-width: 190mm; break-inside: avoid; }
        .slips .slip:nth-of-type(2n) { break-after: page; }
        .label { box-sizing: border-box; width: 92mm; height: 142mm; padding: 4mm; border: 1px solid #000; margin: 0 auto 6mm; overflow: hidden; break-inside: avoid; }
        .labels .label { break-after: page; }
        .labels-a4 .grid4 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
        .labels-a4 .label { width: auto; height: 136mm; margin: 0; }
        .labels-a4 .label:nth-of-type(4n) { break-after: page; }
        @media print {
          .no-print { display: none !important; }
          .slip { border: none; margin: 0; max-width: none; }
          .labels .label { border: none; margin: 0; width: 100%; height: 100%; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white p-3 text-sm">
        <b>{type === 'slips' ? 'Packing slips (A4, 2 per page)' : type === 'labels' ? 'Labels 100 × 150 mm' : 'Labels on A4 (4 per page)'}</b>
        <span className="text-gray-600">{orders ? `${orders.length} order(s), zone route order` : 'Loading…'}</span>
        <span className="ms-auto flex flex-wrap gap-2">
          {type !== 'slips' && <button onClick={() => switchTo('slips')} className="rounded-lg border px-3 py-1.5">Packing slips</button>}
          {type !== 'labels' && <button onClick={() => switchTo('labels')} className="rounded-lg border px-3 py-1.5">Labels 100 × 150</button>}
          {type !== 'labels-a4' && <button onClick={() => switchTo('labels-a4')} className="rounded-lg border px-3 py-1.5">Labels on A4 (4 per page)</button>}
          <button onClick={() => window.print()} className="rounded-lg bg-black px-4 py-1.5 font-semibold text-white">Print</button>
        </span>
      </div>
      {error && <p className="no-print m-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {orders && orders.length === 0 && <p className="no-print m-4">No orders found.</p>}
      <div className={`p-4 print:p-0 ${type === 'labels-a4' ? 'grid4' : ''}`}>
        {orders?.map((o) => (type === 'slips' ? <Slip key={o._id} o={o} store={store} /> : <Label key={o._id} o={o} />))}
      </div>
    </div>
  )
}
