import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Info, Mail } from 'lucide-react'
import { api } from '../../lib/api'
import { downloadFile } from '../../lib/download'
import { money, reasonLabel } from '../../lib/constants'
import { FilterChip, PageHeader, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'

// Qatar calendar helpers
const qToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
const addDays = (k, n) => new Date(Date.parse(`${k}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const fmtK = (k) => new Date(`${k}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const pctTxt = (v) => (v === null || v === undefined ? '–' : `${v > 0 ? '+' : ''}${v}%`)

function Change({ v, goodWhenUp = true }) {
  if (v === null || v === undefined) return <span className="text-xs text-gray-400">no previous data</span>
  const good = v === 0 ? null : (v > 0) === goodWhenUp
  return <span className={`text-xs font-semibold ${good === null ? 'text-gray-500' : good ? 'text-emerald-700' : 'text-red-700'}`}>{pctTxt(v)} vs previous</span>
}

function Kpi({ label, value, change, goodWhenUp, strong }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${strong ? 'ring-1 ring-ink' : ''}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-0.5 text-xl font-extrabold ${strong && typeof value === 'string' && value.includes('-') ? 'text-red-700' : ''}`}>{value}</div>
      <Change v={change} goodWhenUp={goodWhenUp} />
    </div>
  )
}

// profit per day: one series, bars from a zero line (negative days go below it); hover shows the numbers
function ProfitChart({ days }) {
  const [hover, setHover] = useState(null)
  const W = 640
  const H = 180
  const pad = { t: 10, b: 22, l: 8, r: 8 }
  const max = Math.max(1, ...days.map((d) => d.profit))
  const min = Math.min(0, ...days.map((d) => d.profit))
  const span = max - min || 1
  const y = (v) => pad.t + ((max - v) / span) * (H - pad.t - pad.b)
  const slot = (W - pad.l - pad.r) / days.length
  const bw = Math.max(2, Math.min(28, slot - 2))
  const zero = y(0)
  const h = hover !== null ? days[hover] : null
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full min-w-[30rem]" role="img" aria-label="Profit per day">
          {[max, max / 2].filter((v) => v > 0).map((v) => <line key={v} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#E7E5E4" strokeWidth="1" />)}
          <line x1={pad.l} x2={W - pad.r} y1={zero} y2={zero} stroke="#D6D3D1" strokeWidth="1" />
          {days.map((d, i) => {
            const x = pad.l + i * slot + (slot - bw) / 2
            const top = Math.min(y(d.profit), zero)
            const hh = Math.max(1, Math.abs(y(d.profit) - zero))
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
                <rect x={x} y={top} width={bw} height={hh} rx={Math.min(4, bw / 2)}
                  fill={d.profit < 0 ? '#DC2626' : hover === i ? '#1E3A8A' : '#2563EB'} opacity={hover === null || hover === i ? 1 : 0.55} />
                {(days.length <= 10 || i % Math.ceil(days.length / 8) === 0) && (
                  <text x={pad.l + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#6B6864">{d.day.slice(8)}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {h && (
        <div className="pointer-events-none absolute end-2 top-2 rounded-xl border border-line bg-white p-2.5 text-xs shadow-[0_8px_24px_rgba(17,17,17,0.12)]">
          <b>{fmtK(h.day)}</b>
          <div>Profit: <b>{money(h.profit)}</b></div>
          <div className="text-gray-600">Revenue {money(h.revenue)} · cost {money(h.baseCost)} · delivery {money(h.delivery)} · ads {money(h.adSpend)}</div>
          <div className="text-gray-600">{h.delivered} delivered · {h.failed} failed</div>
        </div>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-gray-600">
        <span className="flex items-center gap-1"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-[#2563EB]" /> Profit</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-[#DC2626]" /> Loss (below the line)</span>
        <span>Day numbers under the bars.</span>
      </p>
    </div>
  )
}

function ProfitTab() {
  const [kind, setKind] = useState('week')
  const [day, setDay] = useState(qToday())
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api(`/reports/profit?period=${kind}&date=${day}`)
      .then((x) => { if (!cancelled) { setR(x); setError('') } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [kind, day])

  const loading = !r || r.period.kind !== kind || day < r.period.from || day > r.period.to
  const move = (dir) => r && setDay(dir < 0 ? addDays(r.period.from, -1) : addDays(r.period.to, 1))
  const isCurrent = r && qToday() >= r.period.from && qToday() <= r.period.to
  const T = r?.totals
  const C = r?.change || {}

  async function send() {
    setBusy(true)
    setMsg('')
    try {
      const x = await api('/reports/profit/send', { method: 'POST', body: { period: kind, date: day } })
      setMsg(x.sent ? 'Report sent ✓' : `Not sent: ${x.reason}`)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Toolbar>
        <FilterChip active={kind === 'week'} onClick={() => setKind('week')}>Week</FilterChip>
        <FilterChip active={kind === 'month'} onClick={() => setKind('month')}>Month</FilterChip>
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} aria-label="Previous period" className="grid h-10 w-10 place-items-center rounded-lg border bg-white hover:bg-gray-100"><ChevronLeft size={18} /></button>
          <span className="min-w-[13rem] text-center text-sm font-semibold">{r ? `${fmtK(r.period.from)} – ${fmtK(r.period.to)}` : '…'}</span>
          <button onClick={() => move(1)} aria-label="Next period" disabled={isCurrent} className="grid h-10 w-10 place-items-center rounded-lg border bg-white hover:bg-gray-100 disabled:opacity-40"><ChevronRight size={18} /></button>
          {!isCurrent && <button onClick={() => setDay(qToday())} className="ms-1 text-sm underline">Current</button>}
        </div>
        <div className="flex flex-wrap gap-2 md:ms-auto">
          <button onClick={() => downloadFile(`/reports/profit.xlsx?period=${kind}&date=${day}`, `profit-${kind}-${r?.period.from || day}.xlsx`).catch((e) => setMsg(e.message))} className={btn.dark}><Download size={15} /> Export to Excel</button>
          <button onClick={send} disabled={busy} className={btn.ghost}><Mail size={15} /> {busy ? 'Sending…' : 'Send me this report now'}</button>
        </div>
      </Toolbar>
      {msg && <p className="mb-3 text-sm text-gray-600" role="status">{msg}</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && !error && <div className="grid animate-pulse grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-200" />)}</div>}
      {!loading && T && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Orders placed" value={T.placed} change={C.placed} />
            <Kpi label="Delivered" value={T.delivered} change={C.delivered} />
            <Kpi label="Failed" value={T.failed} change={C.failed} goodWhenUp={false} />
            <Kpi label="Delivery rate" value={T.deliveryRate === null ? '–' : `${T.deliveryRate}%`} change={C.deliveryRate} />
            <Kpi label="Revenue (delivered orders)" value={money(T.revenue)} change={C.revenue} />
            <Kpi label="Base cost of delivered units" value={money(T.baseCost)} change={C.baseCost} goodWhenUp={false} />
            <Kpi label="Delivery costs" value={money(T.deliveryCost)} change={C.deliveryCost} goodWhenUp={false} />
            <Kpi label="Ad spend" value={money(T.adSpend)} change={C.adSpend} goodWhenUp={false} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr]">
            <Kpi label="Net profit" value={money(T.net)} change={C.net} strong />
            <div className="flex gap-2 rounded-2xl border bg-gray-50 p-4 text-xs text-gray-600">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                <b>Net profit = revenue of delivered orders − base cost of the delivered units − delivery costs − ad spend.</b>{' '}
                Revenue is the order total (delivery fee charged to the customer included). Base cost = the cost saved on each order line (the product's base cost when it was ordered; the current base cost if none was saved), never the cost with ads spread.
                Delivery costs = {money(r.settings.deliveryCostPerOrder)} per delivered order + {money(r.settings.failedDeliveryCost)} per failed delivery (Settings › Reports). Ad spend = Ads &amp; costs entries for these days (an entry covering several days is spread by day).
                This cash view differs from the product "real cost" (which spreads ads over all units): ads are counted once here, never twice.
              </p>
            </div>
          </div>

          <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Profit per day</h2>
            <ProfitChart days={r.days} />
          </section>

          {(r.best || r.worst) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {r.best && <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">Best product of the period</div><div className="font-bold">{r.best.name}</div><div className="text-sm">{money(r.best.profit)} profit · {r.best.units} units</div></div>}
              {r.worst && <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">Weakest product of the period</div><div className="font-bold">{r.worst.name}</div><div className="text-sm">{money(r.worst.profit)} profit · {r.worst.units} units</div></div>}
            </div>
          )}

          <section className="mt-4 overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full min-w-[46rem] text-sm">
              <thead><tr className="border-b text-xs text-gray-500">
                <th className="p-3 text-start">Product</th><th className="p-3 text-end">Units delivered</th><th className="p-3 text-end">Revenue</th>
                <th className="p-3 text-end">Base cost</th><th className="p-3 text-end">Ad spend</th><th className="p-3 text-end">Profit</th><th className="p-3 text-end">Failed rate</th>
              </tr></thead>
              <tbody className="divide-y">
                {r.products.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3">{p.name}</td><td className="p-3 text-end">{p.units}</td><td className="p-3 text-end">{money(p.revenue)}</td>
                    <td className="p-3 text-end">{money(p.baseCost)}</td><td className="p-3 text-end">{money(p.adSpend)}</td>
                    <td className={`p-3 text-end font-semibold ${p.profit < 0 ? 'text-red-700' : ''}`}>{money(p.profit)}</td>
                    <td className="p-3 text-end">{p.deliveredOrders + p.failedOrders ? `${p.failedRate}%` : '–'}</td>
                  </tr>
                ))}
                {T.adUnassigned > 0 && (
                  <tr className="text-gray-600"><td className="p-3">Ad spend not assigned to a product</td><td /><td /><td /><td className="p-3 text-end">{money(T.adUnassigned)}</td><td className="p-3 text-end">{money(-T.adUnassigned)}</td><td /></tr>
                )}
                {r.products.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500">No delivered or failed orders in this period.</td></tr>}
              </tbody>
            </table>
            <p className="p-3 text-[11px] text-gray-500">Product profit = revenue − base cost − ad spend for that product (delivery costs are counted only in the total above). Failed rate = failed / (delivered + failed) orders with this product, by the day they were delivered or failed.</p>
          </section>
        </>
      )}
    </div>
  )
}

function BreakdownTable({ title, rows, empty = 'No data' }) {
  const list = rows.filter((r) => r.failed > 0 || r.delivered > 0).slice(0, 12)
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {list.length === 0 ? <p className="text-sm text-gray-500">{empty}</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500"><th className="py-1 text-start">Name</th><th className="py-1 text-end">Delivered</th><th className="py-1 text-end">Failed</th><th className="py-1 text-end">Rate</th></tr></thead>
          <tbody className="divide-y">
            {list.map((r) => (
              <tr key={r.key || r.label}>
                <td className="max-w-[14rem] truncate py-1.5" title={r.label}>{r.label}</td>
                <td className="py-1.5 text-end">{r.delivered}</td>
                <td className={`py-1.5 text-end ${r.failed ? 'font-semibold' : ''}`}>{r.failed}</td>
                <td className={`py-1.5 text-end ${r.rate !== null && r.rate < 80 ? 'text-red-700' : ''}`}>{r.rate === null ? '–' : `${r.rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function DeliveryTab() {
  const [to, setTo] = useState(qToday())
  const [from, setFrom] = useState(addDays(qToday(), -29))
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    api(`/reports/delivery?from=${from}&to=${to}`)
      .then((x) => { if (!cancelled) { setD(x); setError('') } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [from, to])
  const quick = (n) => { setTo(qToday()); setFrom(addDays(qToday(), -(n - 1))) }
  const loading = !d || d.from !== from || d.to !== to
  const T = d?.totals
  const maxReason = Math.max(1, ...(d?.byReason || []).map((r) => r.failed))
  return (
    <div>
      <Toolbar>
        {[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([n, l]) => (
          <FilterChip key={n} active={to === qToday() && from === addDays(qToday(), -(n - 1))} onClick={() => quick(n)}>{l}</FilterChip>
        ))}
        <label className="flex items-center gap-1 text-sm text-gray-600">From <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="min-h-10 rounded-lg border bg-white px-2 text-sm" /></label>
        <label className="flex items-center gap-1 text-sm text-gray-600">To <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="min-h-10 rounded-lg border bg-white px-2 text-sm" /></label>
      </Toolbar>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && !error && <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />}
      {!loading && T && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[['Orders placed', T.placed], ['Delivered', T.delivered], ['Failed', T.failed], ['Still open / cancelled', `${T.open} / ${T.cancelled}`]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">{l}</div><div className="text-xl font-extrabold">{v}</div></div>
            ))}
            <div className="col-span-2 rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-ink md:col-span-1">
              <div className="text-xs text-gray-500">Delivery rate</div>
              <div className={`text-xl font-extrabold ${T.deliveryRate !== null && T.deliveryRate < 80 ? 'text-red-700' : ''}`}>{T.deliveryRate === null ? '–' : `${T.deliveryRate}%`}</div>
              <div className="text-xs text-gray-500">Planner default: 80%{T.deliveryRate !== null ? ` (${T.deliveryRate >= 80 ? '+' : ''}${Math.round((T.deliveryRate - 80) * 10) / 10} pts)` : ''}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Orders placed between these dates. Delivery rate = delivered / (delivered + failed); open and cancelled orders are not counted.</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h3 className="mb-2 font-semibold">Failed orders by reason</h3>
              {T.failed === 0 ? <p className="text-sm text-gray-500">No failed orders in this period.</p> : (
                <ul className="space-y-2 text-sm">
                  {d.byReason.filter((r) => r.failed > 0).map((r) => (
                    <li key={r.key}>
                      <div className="flex justify-between"><span>{r.key === 'none' ? 'No reason saved (older orders)' : reasonLabel(r.key)}</span><b>{r.failed}</b></div>
                      <div className="mt-1 h-2 rounded-full bg-[#E7E5E4]"><div className="h-2 rounded-full bg-[#2563EB]" style={{ width: `${(r.failed / maxReason) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h3 className="mb-2 font-semibold">By day (orders placed)</h3>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr className="text-xs text-gray-500"><th className="py-1 text-start">Day</th><th className="py-1 text-end">Placed</th><th className="py-1 text-end">Delivered</th><th className="py-1 text-end">Failed</th></tr></thead>
                  <tbody className="divide-y">
                    {[...d.byDay].reverse().filter((x) => x.placed).map((x) => (
                      <tr key={x.day}><td className="py-1">{fmtK(x.day)}</td><td className="py-1 text-end">{x.placed}</td><td className="py-1 text-end">{x.delivered}</td><td className={`py-1 text-end ${x.failed ? 'font-semibold' : ''}`}>{x.failed}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <BreakdownTable title="By zone" rows={d.byZone} />
            <BreakdownTable title="By product" rows={d.byProduct} />
            <BreakdownTable title="By campaign" rows={d.byCampaign} />
            <BreakdownTable title="By ad" rows={d.byAd} />
            <BreakdownTable title="By ad angle" rows={d.byAngle} />
          </div>
        </>
      )}
    </div>
  )
}

export default function Reports() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'delivery' ? 'delivery' : 'profit'
  return (
    <div>
      <PageHeader title="Reports" subtitle="Qatar time. Weeks run Saturday to Friday." />
      <div className="mb-4 flex gap-1 border-b" role="tablist">
        {[['profit', 'Profit (week / month)'], ['delivery', 'Delivery performance']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'profit' ? {} : { tab: k }, { replace: true })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      {tab === 'profit' ? <ProfitTab /> : <DeliveryTab />}
    </div>
  )
}
