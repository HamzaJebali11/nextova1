import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../../lib/api'
import { money, fmtDate } from '../../lib/constants'
import StatusBadge from '../components/StatusBadge'

// ---- chart palette: blues (red only for a loss) ----
// The three blues are told apart by lightness AND by line style (revenue solid + soft fill, profit dashed),
// by the legend and by the Table view. Colours follow the entity: revenue is always #2563EB,
// profit always the dark #1E3A8A, orders the light #93C5FD.
const C = {
  revenue: '#2563EB',
  profit: '#1E3A8A',    // dashed line
  orders: '#93C5FD',
  placed: '#93C5FD',
  delivered: '#2563EB',
  cogs: '#1E3A8A',      // base cost
  adCost: '#2563EB',    // product ads inside the real cost
  shipping: '#60A5FA',
  ads: '#BFDBFE',       // general ads
  profitBar: '#2563EB',
  loss: '#DC2626',      // negative profit, always with its value
  grid: '#E7E5E4',
  axis: '#6B6864',
}
const activeDot = (color) => ({ r: 5, fill: color, stroke: '#FFFFFF', strokeWidth: 2 })

const PERIODS = [
  ['day', 'Day', 'last 30 days', 'previous 30 days'],
  ['week', 'Week', 'last 12 weeks', 'previous 12 weeks'],
  ['month', 'Month', 'last 12 months', 'previous 12 months'],
]

function label(period, key) {
  const d = new Date(`${key}T00:00:00Z`)
  if (period === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const compact = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : v)
const pctChange = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null)

// ---------------- small pieces ----------------

function Delta({ now, before, prevLabel }) {
  const d = pctChange(now, before)
  if (d === null) return <div className="mt-1 text-xs text-gray-500">No data for the {prevLabel}</div>
  const up = d > 0
  const Icon = d === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight
  const tone = d === 0 ? 'text-gray-600' : up ? 'text-ink' : 'text-red-700'
  return (
    <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {up ? '+' : ''}{d}% <span className="font-normal text-gray-500">vs {prevLabel}</span>
    </div>
  )
}

function Kpi({ title, value, now, before, prevLabel, negative }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{title}</div>
      <div className={`mt-1 text-2xl font-extrabold ${negative ? 'text-red-700' : ''}`}>{value}</div>
      <Delta now={now} before={before} prevLabel={prevLabel} />
    </div>
  )
}

function Snapshot({ title, k }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{title}</div>
      <div className={`mt-1 text-xl font-extrabold ${k.profit < 0 ? 'text-red-700' : ''}`}>{money(k.profit)}</div>
      <div className="text-[11px] text-gray-500">profit</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div><div className="font-semibold">{money(k.revenue)}</div><div className="text-gray-500">Revenue</div></div>
        <div><div className="font-semibold">{k.delivered}</div><div className="text-gray-500">Delivered</div></div>
        <div><div className="font-semibold">{k.placed}</div><div className="text-gray-500">Orders</div></div>
      </div>
    </motion.div>
  )
}

// items: [name, color, kind] with kind 'line' | 'dashed' | 'bar' (default) | 'outline'
function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-800">
      {items.map(([name, color, kind = 'bar']) => (
        <li key={name} className="flex items-center gap-1.5">
          {kind === 'line' || kind === 'dashed' ? (
            <svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={kind === 'dashed' ? '5 3' : undefined} /></svg>
          ) : (
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: kind === 'outline' ? '#FFFFFF' : color, boxShadow: `inset 0 0 0 1px ${kind === 'outline' ? color : 'rgba(0,0,0,0.08)'}` }} />
          )}
          {name}
        </li>
      ))}
    </ul>
  )
}

function ChartTip({ active, payload, label: title, format = money }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-[0_8px_24px_rgba(17,17,17,0.12)]">
      <div className="mb-1 font-semibold">{title}</div>
      {payload.filter((p) => p.type !== 'none').map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: p.color || p.payload?.fill, boxShadow: p.color === '#FFFFFF' ? 'inset 0 0 0 1px #2563EB' : undefined }} />
            {p.name}
          </span>
          <b>{format(p.value)}</b>
        </div>
      ))}
    </div>
  )
}

// a chart card with a "Table" view (needed because some palette colours are light on the paper card)
function ChartCard({ title, hint, legend, columns, rows, children, height = 'h-64 md:h-72' }) {
  const [table, setTable] = useState(false)
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm md:p-5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-gray-500">{hint}</p>}
        </div>
        <div className="flex rounded-full border p-0.5 text-xs" role="group" aria-label="View">
          {[['Chart', false], ['Table', true]].map(([txt, v]) => (
            <button key={txt} type="button" onClick={() => setTable(v)} aria-pressed={table === v}
              className={`rounded-full px-3 py-1 ${table === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {txt}
            </button>
          ))}
        </div>
      </div>
      {legend && !table && <div className="mb-2"><Legend items={legend} /></div>}
      {table ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-xs text-gray-500">
                {columns.map(([key, name], i) => (
                  <th key={key} className={`py-2 ${i === 0 ? 'text-start' : 'text-end'}`}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, j) => (
                <tr key={j} className="border-b last:border-0">
                  {columns.map(([key, , fmt], i) => (
                    <td key={key} className={`py-1.5 ${i === 0 ? 'text-start font-medium' : 'text-end'}`}>
                      {fmt ? fmt(r[key]) : r[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={height}>{children}</div>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading charts">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-200" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border bg-white p-5">
            <div className="mb-4 h-4 w-40 rounded bg-gray-200" />
            <div className="flex h-56 items-end gap-2">
              {[40, 65, 50, 80, 60, 90, 70, 55, 85, 75].map((h, j) => (
                <div key={j} className="flex-1 rounded-t bg-gray-100" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const axisProps = { tick: { fontSize: 11, fill: C.axis }, tickLine: false, axisLine: { stroke: C.grid } }

// ---------------- page ----------------

export default function Dashboard() {
  const [period, setPeriod] = useState('day')
  const [data, setData] = useState(null)
  const [low, setLow] = useState([])
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api(`/analytics?period=${period}`)
      .then((d) => { if (!cancelled) { setData({ ...d, forPeriod: period }); setError('') } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [period])

  useEffect(() => {
    api('/products/admin/all?lowStock=true&limit=8').then((d) => setLow(d.items)).catch(() => {})
    api('/orders?limit=5').then((d) => setRecent(d.items)).catch(() => {})
  }, [])

  const [, , rangeLabel, prevLabel] = PERIODS.find((p) => p[0] === period)
  const ready = data && data.forPeriod === period
  const rows = ready ? data.buckets.map((b) => ({ ...b, name: label(period, b.key) })) : []
  const cur = ready ? data.current : null
  const prev = ready ? data.previous : null
  const margin = (k) => (k && k.revenue > 0 ? Math.round((k.profit / k.revenue) * 1000) / 10 : 0)
  const products = ready
    ? [...data.products].sort((a, b) => b.profit - a.profit).map((p) => ({ ...p, short: p.name?.length > 22 ? `${p.name.slice(0, 21)}…` : p.name }))
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">Revenue, profit and orders, {rangeLabel}.</p>
        </div>
        <div className="flex rounded-full border bg-white p-1" role="group" aria-label="Group by">
          {PERIODS.map(([value, text]) => (
            <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value}
              className={`min-h-9 rounded-full px-4 text-sm font-medium transition ${period === value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {text}
            </button>
          ))}
        </div>
      </div>

      {data?.missingCost > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-gray-300 bg-white p-4 text-sm text-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            {data.missingCost} active product(s) have no base cost, so profit looks higher than it really is.{' '}
            <Link to="/admin/products" className="font-semibold underline">Add costs in Products</Link>.
          </div>
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {!ready && !error && <Skeleton />}

      {ready && (
        <>
          {/* Period totals with comparison */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi title="Revenue (delivered)" value={money(cur.revenue)} now={cur.revenue} before={prev.revenue} prevLabel={prevLabel} />
            <Kpi title="Profit" value={money(cur.profit)} now={cur.profit} before={prev.profit} prevLabel={prevLabel} negative={cur.profit < 0} />
            <Kpi title="Orders placed" value={cur.placed} now={cur.placed} before={prev.placed} prevLabel={prevLabel} />
            <Kpi title="Margin" value={`${margin(cur)}%`} now={margin(cur)} before={margin(prev)} prevLabel={prevLabel} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Revenue and profit"
              hint="Cash collected on delivered orders, and what is left after costs."
              legend={[['Revenue', C.revenue, 'line'], ['Profit (dashed)', C.profit, 'dashed']]}
              columns={[['name', 'Date'], ['revenue', 'Revenue', money], ['profit', 'Profit', money]]}
              rows={rows}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="nxRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...axisProps} axisLine={false} tickFormatter={compact} width={44} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: '#93C5FD', strokeDasharray: '3 3' }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.revenue} strokeWidth={2.25} fill="url(#nxRevenueFill)" dot={false} activeDot={activeDot(C.revenue)} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke={C.profit} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={activeDot(C.profit)} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Orders"
              hint="Placed by order date, delivered by delivery date."
              legend={[['Placed (light blue)', C.placed], ['Delivered (blue)', C.delivered]]}
              columns={[['name', 'Date'], ['placed', 'Placed'], ['delivered', 'Delivered']]}
              rows={rows}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={32} />
                  <Tooltip content={<ChartTip format={(v) => v} />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                  <Bar dataKey="placed" name="Placed" fill={C.placed} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="delivered" name="Delivered" fill={C.delivered} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Profit per product"
              hint={`Delivered in the ${rangeLabel}: revenue − units × real cost per unit (base cost + product ads).`}
              columns={[['name', 'Product'], ['units', 'Units'], ['revenue', 'Revenue', money], ['cogs', 'Base cost', money], ['adCost', 'Ads in cost', money], ['profit', 'Profit', money]]}
              rows={products}
              height={products.length ? 'h-64 md:h-72' : 'h-24'}
            >
              {products.length === 0 ? (
                <p className="pt-6 text-center text-sm text-gray-500">No delivered orders in this period yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={products} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={compact} />
                    <YAxis type="category" dataKey="short" {...axisProps} width={120} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                    <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {products.map((p) => <Cell key={p.id || p.name} fill={p.profit < 0 ? C.loss : C.profitBar} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Where your revenue goes"
              hint="Base cost + product ads + shipping + general ads + profit = revenue."
              legend={[['Base cost', C.cogs], ['Product ads', C.adCost], ['Shipping', C.shipping], ['General ads', C.ads], ['Profit (white, blue outline)', C.revenue, 'outline']]}
              columns={[['name', 'Date'], ['cogs', 'Base cost', money], ['adCost', 'Product ads', money], ['shipping', 'Shipping', money], ['ads', 'General ads', money], ['profit', 'Profit', money]]}
              rows={rows}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...axisProps} axisLine={false} tickFormatter={compact} width={44} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                  {[['cogs', 'Base cost'], ['adCost', 'Product ads'], ['shipping', 'Shipping'], ['ads', 'General ads'], ['profit', 'Profit']].map(([key, name], i, all) => (
                    <Bar key={key} dataKey={key} name={name} stackId="a" fill={key === 'profit' ? '#FFFFFF' : C[key]} stroke={key === 'profit' ? C.revenue : '#FFFFFF'} strokeWidth={1}
                      radius={i === all.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Snapshot title="Today" k={data.kpis.today} />
            <Snapshot title="This week" k={data.kpis.week} />
            <Snapshot title="This month" k={data.kpis.month} />
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500">In progress</div>
              <div className="mt-1 text-xl font-extrabold">{money(data.inProgress.value)}</div>
              <div className="text-[11px] text-gray-500">{data.inProgress.count} order(s) not delivered yet</div>
            </div>
          </div>

          <details className="rounded-2xl border bg-white p-4 text-sm shadow-sm">
            <summary className="cursor-pointer font-semibold">How profit is calculated</summary>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-gray-600">
              <li><b>Revenue</b> = total of delivered orders (including the delivery fee), on the day they were delivered.</li>
              <li><b>Real cost per unit</b> = base cost + (all ad spend linked to the product ÷ units purchased).</li>
              <li><b>Profit</b> = revenue − units delivered × real cost per unit − shipping cost − general ads (ads not linked to a product, spread over their days).</li>
              <li>Costs use <b>today&apos;s</b> values for every order, old ones too. Orders are never rewritten; a deleted product uses the cost saved on its orders.</li>
            </ul>
          </details>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Recent orders</h2>
          {recent.length === 0 && <p className="text-sm text-gray-500">No orders yet.</p>}
          <ul className="divide-y">
            {recent.map((o) => (
              <li key={o._id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{o.orderNumber} · {o.customer.name}</div>
                  <div className="text-xs text-gray-500">{fmtDate(o.createdAt)}</div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-semibold">{money(o.total)}</div>
                  <StatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <AlertTriangle size={18} className="text-ink" /> Low stock
          </h2>
          {low.length === 0 && <p className="text-sm text-gray-500">All products are well stocked.</p>}
          <ul className="divide-y">
            {low.map((p) => (
              <li key={p._id} className="flex items-center justify-between py-3">
                <span className="font-medium">{p.name.en}</span>
                <span className={`text-sm font-semibold ${p.stock === 0 ? 'text-red-600' : 'text-ink'}`}>{p.stock} left</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
