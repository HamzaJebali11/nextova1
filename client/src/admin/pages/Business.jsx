import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const rate = (v) => (v === null || v === undefined ? '–' : `${v}%`)

function Card({ title, value, hint }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  )
}

function Chart({ title, data }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="orders" name="Orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function Table({ title, rows, overall }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-gray-500">No orders in this period.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="py-2 text-start">Name</th>
                <th className="text-end">Orders</th>
                <th className="text-end">Delivered</th>
                <th className="text-end">Returned / cancelled</th>
                <th className="text-end">Open</th>
                <th className="text-end">Delivery rate</th>
                <th className="text-end">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const low = r.deliveryRate !== null && overall !== null && r.deliveryRate < overall - 15
                return (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="max-w-[16rem] truncate py-2 font-medium" title={r.name}>{r.name}</td>
                    <td className="text-end">{r.placed}</td>
                    <td className="text-end">{r.delivered}</td>
                    <td className="text-end">{r.returned + r.cancelled}</td>
                    <td className="text-end">{r.open}</td>
                    <td className={`text-end font-semibold ${low ? 'text-red-600' : ''}`}>{rate(r.deliveryRate)}</td>
                    <td className="text-end">{money(r.revenue)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function Business() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api(`/health?days=${days}`)
      .then((d) => { if (!cancelled) setData({ ...d, forDays: days }) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [days])

  const ready = data && data.forDays === days
  const f = ready ? data.funnel : null
  const p = ready ? data.pipeline : null
  const pctOf = (n) => (f && f.visitors ? Math.round((n / f.visitors) * 1000) / 10 : null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Business health</h1>
          <p className="text-sm text-gray-500">What really happens to your orders, and where you lose customers.</p>
        </div>
        <div className="flex gap-2">
          {RANGES.map(([value, text]) => (
            <button key={value} onClick={() => setDays(value)}
              className={`rounded-full px-4 py-2 text-sm ${days === value ? 'bg-gray-900 text-white' : 'border bg-white hover:bg-gray-100'}`}>
              {text}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {!ready && !error && <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">Loading…</div>}

      {ready && (
        <>
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">From visit to order (website)</h2>
            <div className="space-y-4">
              {[
                ['Visitors', f.visitors],
                ['Looked at a product', f.viewers],
                ['Placed an order', f.websiteOrders],
              ].map(([label, n], i) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{label}</span>
                    <b>{n}{i > 0 && <span className="ms-2 font-normal text-gray-500">{rate(pctOf(n))} of visitors</span>}</b>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100">
                    <div className="h-3 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (n / Math.max(1, f.visitors)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {f.unfinished} people left their number without ordering (see Unfinished orders).
              If many visitors look at a product but few order, work on the product page. If few look at a product, work on the ad.
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card title="Orders placed" value={p.placed} hint="All sources" />
            <Card title="Delivered" value={p.delivered} hint={money(p.revenue)} />
            <Card title="Returned or cancelled" value={p.returned + p.cancelled} hint={`${rate(p.failRate)} of finished orders`} />
            <Card title="Still open" value={p.open} hint="New, confirmed, on the way" />
            <Card title="Delivery rate" value={rate(p.deliveryRate)} hint="Delivered out of all finished orders" />
            <Card title="Average order value" value={money(data.aov)} hint="Without cancelled or returned" />
            <Card title="Average time to deliver" value={data.avgDeliveryHours === null ? '–' : `${data.avgDeliveryHours} h`} hint="From order to delivery" />
            <Card title="Returning customers" value={rate(data.returning.rate)} hint={`${data.returning.returning} of ${data.returning.customers} had ordered before`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Chart title="Orders by hour of the day" data={data.byHour.map((n, h) => ({ name: `${h}h`, orders: n }))} />
            <Chart title="Orders by day of the week" data={data.byWeekday.map((n, d) => ({ name: WEEKDAYS[d], orders: n }))} />
          </div>

          <Table title="By ad campaign" rows={data.byCampaign} overall={p.deliveryRate} />
          <Table title="By area" rows={data.byArea} overall={p.deliveryRate} />

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Running out soon</h2>
            {data.stockRisk.length === 0 && <p className="text-sm text-gray-500">Nothing will run out in the next 10 days at the current speed.</p>}
            <ul className="divide-y text-sm">
              {data.stockRisk.map((s) => (
                <li key={s.name} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium">{s.name}</span>
                  <span className={s.stock <= 0 ? 'font-semibold text-red-600' : 'text-gray-600'}>
                    {s.stock <= 0 ? 'Sold out' : `${s.stock} left · sells about ${s.perDay} a day · about ${s.daysLeft} days left`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <details className="rounded-2xl border bg-white p-5 text-sm shadow-sm">
            <summary className="cursor-pointer font-semibold">How to read this page</summary>
            <ul className="mt-3 list-disc space-y-1 ps-5 text-gray-600">
              <li>A campaign or area shown in <b className="text-red-600">red</b> delivers far less than your average: its orders cost more than they look.</li>
              <li>Compare two periods (7 days against 30 days) before you decide anything.</li>
              <li>Orders by hour: have your confirmation calls ready for the busiest hours, and test your ads at those hours.</li>
              <li>Change one thing at a time, then watch this page for a week.</li>
            </ul>
          </details>
        </>
      )}
    </div>
  )
}