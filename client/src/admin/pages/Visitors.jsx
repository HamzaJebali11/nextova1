import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'

const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']]

const label = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

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

  const cards = t
    ? [
        ['Visitors today', t.today],
        ['Visitors yesterday', t.yesterday],
        ['Last 7 days', t.last7],
        [`Last ${days} days`, t.range],
        ['Page views', t.pageViews],
        ['Orders', t.orders],
        ['Conversion', `${t.conversion}%`],
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Visitors</h1>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {cards.map(([name, value]) => (
              <div key={name} className="rounded-2xl border bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-extrabold">{value}</div>
                <div className="text-xs text-gray-500">{name}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Visitors and orders per day</h2>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="visitors" name="Visitors" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Line dataKey="orders" name="Orders" stroke="#16a34a" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Where visitors come from</h2>
              {data.sources.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
              <ul className="divide-y text-sm">
                {data.sources.map((s) => (
                  <li key={s.name} className="flex justify-between py-2"><span>{s.name}</span><b>{s.visitors}</b></li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Most viewed products</h2>
              {data.products.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
              <ul className="divide-y text-sm">
                {data.products.map((p) => (
                  <li key={p.slug} className="flex justify-between py-2"><span>{p.name}</span><b>{p.visitors}</b></li>
                ))}
              </ul>
            </section>
          </div>

          <p className="text-xs text-gray-500">
            Counts unique browsers per day, so one person on two phones counts twice. Your own visits while logged in and known bots are
            left out, and ad blockers can hide a few visits. "Conversion" is orders placed divided by visitors.
          </p>
        </>
      )}
    </div>
  )
}