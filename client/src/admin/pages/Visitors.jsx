import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'
import { FilterChip, PageHeader } from '../components/ListKit'

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']]
const C = { visitors: '#111111', orders: '#55524E', grid: '#E2E0DC', axis: '#6B6864' }
const axisProps = { tick: { fontSize: 11, fill: C.axis }, tickLine: false, axisLine: { stroke: C.grid } }

const label = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const rate = (v) => (v === null || v === undefined ? '–' : `${v}%`)

function Tip({ active, payload, label: title }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{title}</div>
      {payload.map((p) => <div key={p.dataKey}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  )
}

function DayChart({ title, rows, dataKey, name, color }) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm md:p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={32} />
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
            <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default function Visitors() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api(`/stats/visitors?days=${days}`)
      .then((d) => { if (!cancelled) setData({ ...d, forDays: days }) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [days])

  const ready = data && data.forDays === days
  const t = ready ? data.totals : null
  const rows = ready ? data.series.map((d) => ({ ...d, name: label(d.day) })) : []
  const maxSource = ready ? Math.max(1, ...data.sources.map((s) => s.visitors)) : 1
  const maxProduct = ready ? Math.max(1, ...data.products.map((p) => p.visitors)) : 1
  const deviceTotal = ready ? data.devices.reduce((s, d) => s + d.visitors, 0) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        subtitle="Who visits, where they come from, and how many order."
        actions={RANGES.map(([value, text]) => (
          <FilterChip key={value} active={days === value} onClick={() => setDays(value)}>{text}</FilterChip>
        ))}
      />

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {!ready && !error && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-200" />)}</div>
          <div className="h-64 rounded-2xl bg-gray-200" />
        </div>
      )}

      {ready && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Visitors', t.range, `today ${t.today} · yesterday ${t.yesterday} · 7 days ${t.last7}`],
              ['Page views', t.pageViews, t.range ? `${Math.round((t.pageViews / t.range) * 10) / 10} per visitor` : ''],
              ['Website orders', t.orders, `last ${days} days`],
              ['Conversion rate', `${t.conversion}%`, 'orders ÷ visitors'],
            ].map(([name, value, hint]) => (
              <div key={name} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500">{name}</div>
                <div className="mt-1 text-2xl font-extrabold">{value}</div>
                <div className="text-[11px] text-gray-500">{hint}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DayChart title="Visitors per day" rows={rows} dataKey="visitors" name="Visitors" color={C.visitors} />
            <DayChart title="Website orders per day" rows={rows} dataKey="orders" name="Orders" color={C.orders} />
          </div>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold">Sources and conversion</h2>
            <p className="mb-3 text-xs text-gray-500">Visitors per source, the website orders that came from it, and its conversion rate.</p>
            {data.sources.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
            {data.sources.length > 0 && (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-500">
                      <th className="py-2 text-start">Source</th>
                      <th className="text-start">Visitors</th>
                      <th className="text-end">Orders</th>
                      <th className="text-end">Revenue</th>
                      <th className="text-end">Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => (
                      <tr key={s.name} className="border-b last:border-0">
                        <td className="max-w-[14rem] truncate py-2 font-medium" title={s.name}>{s.name}</td>
                        <td className="w-1/3 py-2 pe-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-gray-100">
                              <div className="h-2 rounded-full" style={{ width: `${(s.visitors / maxSource) * 100}%`, background: C.visitors }} />
                            </div>
                            <span className="w-10 text-end">{s.visitors}</span>
                          </div>
                        </td>
                        <td className="text-end">{s.orders}</td>
                        <td className="text-end">{money(s.revenue)}</td>
                        <td className="text-end font-semibold">{rate(s.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Phone or computer</h2>
              {deviceTotal === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
              <ul className="space-y-3 text-sm">
                {data.devices.map((d) => {
                  const share = deviceTotal ? Math.round((d.visitors / deviceTotal) * 100) : 0
                  return (
                    <li key={d.name}>
                      <div className="mb-1 flex justify-between"><span className="capitalize">{d.name}</span><b>{share}% · {d.visitors}</b></div>
                      <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full" style={{ width: `${share}%`, background: C.visitors }} /></div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Most viewed products</h2>
              {data.products.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
              <ul className="space-y-3 text-sm">
                {data.products.map((p) => (
                  <li key={p.slug}>
                    <div className="mb-1 flex justify-between gap-3"><span className="truncate">{p.name}</span><b>{p.visitors}</b></div>
                    <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full" style={{ width: `${(p.visitors / maxProduct) * 100}%`, background: C.visitors }} /></div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="text-xs text-gray-500">
            Counts unique browsers per day, so one person on two phones counts twice. Your own visits while logged in and known bots
            are left out, and ad blockers can hide a few visits. Orders placed before ad tracking was added show as “unknown”.
          </p>
        </>
      )}
    </div>
  )
}
