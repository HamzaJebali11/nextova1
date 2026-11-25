import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'

const inputCls =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

// Get date in Qatar timezone (UTC+3)
const qDate = (d = Date.now()) => {
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qatar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

// Add days without timezone conversion problems
const addDays = (key, n) => {
  if (!key || !Number.isFinite(Number(n))) return ''
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day + Number(n)))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

const dash = (v) => (v === null || v === undefined ? '–' : money(v))
const emptyForm = () => ({ startDate: qDate(), days: 7, amount: '', platform: 'Facebook', note: '', product: '' })

export default function AdSpend() {
  const [list, setList] = useState([])
  const [products, setProducts] = useState([])
  const [days, setDays] = useState(30)
  const [report, setReport] = useState(null)
  const [f, setF] = useState(emptyForm)
  const [editing, setEditing] = useState(null) // id of the entry being edited
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const load = useCallback(() => api('/adspend').then(setList).catch((err) => console.error('Failed to load ad costs:', err)), [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let cancelled = false
    api('/products/admin/all?limit=100')
      .then((data) => { if (!cancelled) setProducts(data.items || []) })
      .catch((err) => console.error('Failed to load products:', err))
    return () => { cancelled = true }
  }, [])

  // the report reloads whenever the list changes, so the real cost follows every add / edit / delete
  useEffect(() => {
    let cancelled = false
    api(`/adspend/by-product?days=${days}`)
      .then((data) => { if (!cancelled) setReport({ ...data, forDays: days }) })
      .catch((err) => { if (!cancelled) console.error('Failed to load ad spend report:', err) })
    return () => { cancelled = true }
  }, [days, list])

  // orders and revenue per ad (from the ad data saved on each website order)
  const [byAd, setByAd] = useState(null)
  useEffect(() => {
    let cancelled = false
    api(`/orders/by-ad?days=${days}`)
      .then((d) => { if (!cancelled) setByAd({ ...d, forDays: days }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [days])

  // orders and revenue per ad angle page (?angle=slug)
  const [byAngle, setByAngle] = useState(null)
  useEffect(() => {
    let cancelled = false
    api(`/orders/by-angle?days=${days}`)
      .then((d) => { if (!cancelled) setByAngle({ ...d, forDays: days }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [days])

  function startEdit(a) {
    setEditing(a._id)
    setError('')
    setSaved('')
    setF({
      startDate: qDate(a.startDate),
      days: a.days,
      amount: a.amount,
      platform: a.platform || '',
      note: a.note || '',
      product: a.product?._id || a.product || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setF(emptyForm())
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaved('')
    const body = { ...f, days: Number(f.days), amount: Number(f.amount), product: f.product || '' }
    try {
      if (editing) {
        await api(`/adspend/${editing}`, { method: 'PUT', body })
        setSaved('Entry updated ✓ Real cost per unit recalculated.')
        setEditing(null)
        setF(emptyForm())
      } else {
        await api('/adspend', { method: 'POST', body: { ...body, product: f.product || undefined } })
        setSaved('Ad cost added ✓ Real cost per unit recalculated.')
        setF((prev) => ({ ...prev, amount: '', note: '' }))
      }
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this ad cost entry?')) return
    try {
      await api(`/adspend/${id}`, { method: 'DELETE' })
      if (editing === id) cancelEdit()
      await load()
    } catch (err) {
      window.alert(err.message)
    }
  }

  // spending this month
  const month = qDate().slice(0, 7)
  const thisMonth = list.reduce((sum, a) => {
    const start = qDate(a.startDate)
    if (!start || !a.days || !Number.isFinite(Number(a.amount))) return sum
    let total = 0
    for (let i = 0; i < Number(a.days); i++) {
      if (addDays(start, i).startsWith(month)) total += Number(a.amount) / Number(a.days)
    }
    return sum + total
  }, 0)

  const ready = report && report.forDays === days

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Ads &amp; costs</h1>
      <p className="mb-5 text-sm text-gray-500">
        Enter what you spent on ads. Choose 7 days to enter a weekly total, or 1 day for a daily amount. It is spread
        evenly across those days. Pick a <b>product</b> when the ad promotes one product: its spend is then added to that
        product&apos;s <b>real cost per unit</b>.
      </p>

      {/* Add / edit ad cost */}
      <form onSubmit={submit} className={`mb-6 rounded-2xl border bg-white p-5 shadow-sm ${editing ? 'ring-2 ring-ink' : ''}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editing ? 'Edit ad cost' : 'Add ad cost'}</h2>
          {editing && (
            <button type="button" onClick={cancelEdit} className="flex items-center gap-1 text-sm text-gray-600 hover:underline">
              <X size={14} /> Cancel editing
            </button>
          )}
        </div>
        {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        {saved && <div className="mb-3 rounded-lg bg-gray-100 p-3 text-sm text-ink">{saved}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Start date</span>
            <input type="date" required className={inputCls} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Covers (days)</span>
            <input type="number" min="1" max="366" required className={inputCls} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Total amount (QAR)</span>
            <input type="number" min="0" step="0.01" required className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </label>
          <label className="block lg:col-span-2">
            <span className="mb-1 block text-xs font-medium">Product (optional)</span>
            <select className={inputCls} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })}>
              <option value="">Not for one product (general)</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>{p.name?.en || 'Unnamed product'}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Platform</span>
            <input className={inputCls} value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} />
          </label>
          <label className="block lg:col-span-6">
            <span className="mb-1 block text-xs font-medium">Note (optional)</span>
            <input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </label>
        </div>

        <button type="submit" className="mt-4 rounded-lg px-5 py-2 bg-accent font-bold text-white hover:bg-accent-hover">
          {editing ? 'Save changes' : 'Add ad cost'}
        </button>
      </form>

      {/* Real cost and profit per product */}
      <section className="mb-8 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Real cost and profit per product</h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button type="button" key={d} onClick={() => setDays(d)}
                className={`rounded-full px-3 py-1.5 text-sm ${days === d ? 'bg-gray-900 text-white' : 'border hover:bg-gray-100'}`}>
                {d} days
              </button>
            ))}
          </div>
        </div>

        {!ready && <p className="text-sm text-gray-500">Loading…</p>}
        {ready && report.rows.length === 0 && (
          <p className="text-sm text-gray-500">No ad costs assigned to a product, and no sales in this period yet.</p>
        )}

        {ready && report.rows.length > 0 && (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="py-2 text-start">Product</th>
                  <th className="text-end">Base cost</th>
                  <th className="text-end" title="All ad spend linked to the product ÷ units purchased">Ads / unit</th>
                  <th className="text-end">Real cost / unit</th>
                  <th className="text-end">Units purchased</th>
                  <th className="text-end">Ad spend ({days}d)</th>
                  <th className="text-end">Units sold</th>
                  <th className="text-end">Orders</th>
                  <th className="text-end">Revenue</th>
                  <th className="text-end">Profit</th>
                  <th className="text-end">Profit / unit</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">
                      {r.name}
                      {r.needsUnits && <div className="text-xs font-semibold text-red-600">Enter units purchased</div>}
                    </td>
                    <td className="text-end">{dash(r.baseCost)}</td>
                    <td className="text-end">
                      {dash(r.adPerUnit)}
                      {r.adSpendTotal > 0 && <div className="text-[11px] text-gray-500">{money(r.adSpendTotal)} total</div>}
                    </td>
                    <td className="text-end font-semibold">{dash(r.realCost)}</td>
                    <td className="text-end">
                      {r.unitsPurchased ?? '–'}
                      {r.unitsPurchasedIsDefault && <div className="text-[11px] text-gray-500">stock + sold</div>}
                    </td>
                    <td className="text-end">{money(r.spend)}</td>
                    <td className="text-end">{r.units}</td>
                    <td className="text-end">{r.orders}</td>
                    <td className="text-end">{money(r.revenue)}</td>
                    <td className={`text-end font-semibold ${r.profit >= 0 ? 'text-ink' : 'text-red-600'}`}>{money(r.profit)}</td>
                    <td className="text-end">{dash(r.profitPerUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ready && (
          <p className="mt-3 text-xs text-gray-500">
            Real cost / unit = base cost + (all ad spend linked to the product ÷ units purchased). Profit = revenue − units
            sold × real cost / unit, before delivery costs and general ads (ads are already inside the real cost, so they
            are not taken off a second time). Units and revenue count paid items in orders placed in the period that were not
            cancelled or returned.
            {report.unassigned > 0 && ` General ad spend (not linked to a product) in this period: ${money(report.unassigned)}.`}
          </p>
        )}
      </section>

      {/* Which ads sell */}
      <section className="mb-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Orders and revenue per ad ({days} days)</h2>
        <p className="mb-3 text-xs text-gray-500">
          Website orders grouped by the ad that first brought the customer (first visit in the 30 days before the order).
          Names come from the ad&apos;s URL parameters: campaign = utm_campaign, ad set = utm_term, ad = utm_content.
        </p>
        {!byAd || byAd.forDays !== days ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : byAd.rows.length === 0 ? (
          <p className="text-sm text-gray-500">No website orders in this period.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="py-2 text-start">Campaign</th>
                  <th className="text-start">Ad set</th>
                  <th className="text-start">Ad</th>
                  <th className="text-end">Orders</th>
                  <th className="text-end">Delivered</th>
                  <th className="text-end">Cancelled / returned</th>
                  <th className="text-end">Revenue</th>
                  <th className="text-end">Delivered revenue</th>
                </tr>
              </thead>
              <tbody>
                {byAd.rows.map((r, i) => {
                  const cell = (name, id) => (
                    <>
                      <div className="font-medium">{name || (id ? '–' : '')}</div>
                      {id && <div className="font-mono text-[11px] text-gray-500">#{id}</div>}
                    </>
                  )
                  return (
                    <tr key={i} className="border-b align-top last:border-0">
                      {r.noAd ? (
                        <td colSpan={3} className="py-2 text-gray-500">
                          {r.source ? `${r.source} (no campaign / ad data)` : 'No ad (direct visit or before tracking)'}
                        </td>
                      ) : (
                        <>
                          <td className="py-2 pe-3">{cell(r.campaign, r.campaignId)}</td>
                          <td className="py-2 pe-3">{cell(r.adset, r.adsetId)}</td>
                          <td className="py-2 pe-3">{cell(r.ad, r.adId)}</td>
                        </>
                      )}
                      <td className="py-2 text-end">{r.orders}</td>
                      <td className="py-2 text-end">{r.delivered}</td>
                      <td className="py-2 text-end">{r.cancelled}</td>
                      <td className="py-2 text-end font-semibold">{money(r.revenue)}</td>
                      <td className="py-2 text-end">{money(r.deliveredRevenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">Revenue leaves out cancelled and returned orders. Filter the Orders page by campaign or ad to see the orders themselves.</p>
      </section>

      <section className="mb-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Orders and revenue per angle ({days} days)</h2>
        <p className="mb-3 text-xs text-gray-500">Website orders grouped by the ad angle page (?angle=slug) the customer saw. Set angles in each product.</p>
        {!byAngle || byAngle.forDays !== days ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : byAngle.rows.length === 0 ? (
          <p className="text-sm text-gray-500">No website orders in this period.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="py-2 text-start">Angle</th>
                  <th className="text-start">Product</th>
                  <th className="text-end">Orders</th>
                  <th className="text-end">Delivered</th>
                  <th className="text-end">Cancelled / returned</th>
                  <th className="text-end">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byAngle.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-mono font-semibold">{r.slug || <span className="font-sans font-normal text-gray-500">No angle (normal page)</span>}</td>
                    <td className="py-2">{r.product || '–'}</td>
                    <td className="text-end">{r.orders}</td>
                    <td className="text-end">{r.delivered}</td>
                    <td className="text-end">{r.cancelled}</td>
                    <td className="text-end font-semibold">{money(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-3 text-sm text-gray-600">
        Spent this month: <b>{money(Math.round(thisMonth * 100) / 100)}</b>
      </div>

      {/* Ad cost history */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {list.length === 0 && <div className="p-6 text-gray-500">No ad costs yet.</div>}
        <ul className="divide-y">
          {list.map((a) => {
            const start = qDate(a.startDate)
            return (
              <li key={a._id} className={`flex items-center justify-between gap-3 p-4 ${editing === a._id ? 'bg-gray-100' : ''}`}>
                <div>
                  <div className="font-semibold">
                    {money(a.amount)}{' '}
                    <span className="text-sm font-normal text-gray-500">
                      · {a.platform}{a.product?.name?.en ? ` · ${a.product.name.en}` : ' · general'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {start} → {addDays(start, a.days - 1)} ({a.days} day{a.days > 1 ? 's' : ''}, about{' '}
                    {money(Math.round((a.amount / a.days) * 100) / 100)} per day){a.note ? ` · ${a.note}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => startEdit(a)} title="Edit" aria-label="Edit entry"
                    className="rounded-lg p-2 hover:bg-gray-100"><Pencil size={18} /></button>
                  <button type="button" onClick={() => remove(a._id)} title="Delete" aria-label="Delete entry"
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
