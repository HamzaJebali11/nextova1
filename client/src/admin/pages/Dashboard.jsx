import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../../lib/api'
import { money, fmtDate } from '../../lib/constants'
import StatusBadge from '../components/StatusBadge'

const PERIODS = [['day', 'Daily · 30 days'], ['week', 'Weekly · 12 weeks'], ['month', 'Monthly · 12 months']]
const C = { revenue: '#6366f1', profit: '#16a34a', cogs: '#94a3b8', shipping: '#f59e0b', ads: '#f43f5e', placed: '#cbd5e1', delivered: '#16a34a' }

function label(period, key) {
  const d = new Date(`${key}T00:00:00Z`)
  if (period === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const compact = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : v)
const moneyTip = (v, name) => [money(v), name]

function Snapshot({ title, k }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`mt-1 text-2xl font-extrabold ${k.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money(k.profit)}</div>
      <div className="text-xs text-gray-500">profit</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><div className="font-semibold">{money(k.revenue)}</div><div className="text-gray-500">Revenue</div></div>
        <div><div className="font-semibold">{k.delivered}</div><div className="text-gray-500">Delivered</div></div>
        <div><div className="font-semibold">{k.placed}</div><div className="text-gray-500">Orders</div></div>
      </div>
    </motion.div>
  )
}

function ChartCard({ title, hint, children }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mb-3 text-xs text-gray-500">{hint}</p>}
      <div className="mt-2 h-72">{children}</div>
    </section>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('day')
  const [data, setData] = useState(null)
  const [low, setLow] = useState([])
  const [recent, setRecent] = useState([])

  useEffect(() => {
    let cancelled = false
    api(`/analytics?period=${period}`)
      .then((d) => { if (!cancelled) setData({ ...d, forPeriod: period }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [period])

  useEffect(() => {
    api('/products/admin/all?lowStock=true&limit=8').then((d) => setLow(d.items)).catch(() => {})
    api('/orders?limit=5').then((d) => setRecent(d.items)).catch(() => {})
  }, [])

  const ready = data && data.forPeriod === period
  const rows = ready ? data.buckets.map((b) => ({ ...b, name: label(period, b.key) })) : []
  const totals = ready
    ? data.buckets.reduce((t, b) => ({
        revenue: t.revenue + b.revenue, cogs: t.cogs + b.cogs, shipping: t.shipping + b.shipping,
        ads: t.ads + b.ads, profit: t.profit + b.profit, delivered: t.delivered + b.delivered, placed: t.placed + b.placed,
      }), { revenue: 0, cogs: 0, shipping: 0, ads: 0, profit: 0, delivered: 0, placed: 0 })
    : null
  const margin = totals && totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 100) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {data?.missingCost > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            {data.missingCost} active product(s) have no cost price, so profit looks higher than it really is.{' '}
            <Link to="/admin/products" className="font-semibold underline">Add costs in Products</Link>. Orders placed before you add a cost keep a cost of 0.
          </div>
        </div>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Snapshot title="Today" k={data.kpis.today} />
          <Snapshot title="This week" k={data.kpis.week} />
          <Snapshot title="This month" k={data.kpis.month} />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">In progress</div>
            <div className="mt-1 text-2xl font-extrabold">{money(data.inProgress.value)}</div>
            <div className="text-xs text-gray-500">{data.inProgress.count} order(s) not delivered yet</div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {PERIODS.map(([value, text]) => (
          <button key={value} onClick={() => setPeriod(value)}
            className={`rounded-full px-4 py-2 text-sm ${period === value ? 'bg-gray-900 text-white' : 'border bg-white hover:bg-gray-100'}`}>
            {text}
          </button>
        ))}
      </div>

      {!ready && <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">Loading charts…</div>}

      {ready && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              ['Revenue', totals.revenue, 'text-indigo-600'],
              ['Product cost', totals.cogs, 'text-slate-500'],
              ['Shipping', totals.shipping, 'text-amber-600'],
              ['Ads', totals.ads, 'text-rose-600'],
              ['Profit', totals.profit, totals.profit >= 0 ? 'text-green-600' : 'text-red-600'],
              ['Margin', `${margin}%`, 'text-gray-900'],
            ].map(([name, value, color]) => (
              <div key={name} className="rounded-2xl border bg-white p-4 text-center shadow-sm">
                <div className={`text-lg font-extrabold ${color}`}>{typeof value === 'number' ? money(value) : value}</div>
                <div className="text-xs text-gray-500">{name}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Revenue and profit" hint="Revenue is cash collected on delivered orders.">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={compact} />
                  <Tooltip formatter={moneyTip} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill={C.revenue} radius={[6, 6, 0, 0]} />
                  <Line dataKey="profit" name="Profit" stroke={C.profit} strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Orders" hint="Placed by order date, delivered by delivery date.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="placed" name="Placed" fill={C.placed} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill={C.delivered} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Where your revenue goes" hint="Product cost + shipping + ads + profit add up to your revenue.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={compact} />
                <Tooltip formatter={moneyTip} />
                <Legend />
                <Bar dataKey="cogs" name="Product cost" stackId="a" fill={C.cogs} />
                <Bar dataKey="shipping" name="Shipping" stackId="a" fill={C.shipping} />
                <Bar dataKey="ads" name="Ads" stackId="a" fill={C.ads} />
                <Bar dataKey="profit" name="Profit" stackId="a" fill={C.profit} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold">Best products in this period</h2>
            <p className="mb-3 text-xs text-gray-500">Profit here is before shipping and ads.</p>
            {data.products.length === 0 && <p className="text-sm text-gray-500">No delivered orders in this period yet.</p>}
            {data.products.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b text-start text-xs text-gray-500">
                      <th className="py-2 text-start">Product</th><th className="text-end">Units</th>
                      <th className="text-end">Revenue</th><th className="text-end">Cost</th>
                      <th className="text-end">Profit</th><th className="text-end">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => {
                      const gross = p.revenue - p.cogs
                      return (
                        <tr key={p.id || p.name} className="border-b last:border-0">
                          <td className="py-2 font-medium">{p.name}</td>
                          <td className="text-end">{p.units}</td>
                          <td className="text-end">{money(p.revenue)}</td>
                          <td className="text-end text-gray-500">{money(p.cogs)}</td>
                          <td className={`text-end font-semibold ${gross >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money(gross)}</td>
                          <td className="text-end">{p.revenue > 0 ? Math.round((gross / p.revenue) * 100) : 0}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
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
            <AlertTriangle size={18} className="text-amber-500" /> Low stock
          </h2>
          {low.length === 0 && <p className="text-sm text-gray-500">All products are well stocked.</p>}
          <ul className="divide-y">
            {low.map((p) => (
              <li key={p._id} className="flex items-center justify-between py-3">
                <span className="font-medium">{p.name.en}</span>
                <span className={`text-sm font-semibold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>{p.stock} left</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}