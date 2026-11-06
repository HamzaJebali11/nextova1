
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'

const inputCls =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

// Get date in Qatar timezone (UTC+3)
const qDate = (d = Date.now()) => {
  const date = new Date(d)

  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

export default function AdSpend() {
  const [list, setList] = useState([])
  const [products, setProducts] = useState([])
  const [days, setDays] = useState(30)
  const [report, setReport] = useState(null)

  const [f, setF] = useState({
    startDate: qDate(),
    days: 7,
    amount: '',
    platform: 'Facebook',
    note: '',
    product: '',
  })

  const [error, setError] = useState('')

  // Load ad costs
  const load = () => api('/adspend').then(setList)

  useEffect(() => {
    let cancelled = false

    async function fetchList() {
      try {
        const data = await api('/adspend')
        if (!cancelled) setList(data)
      } catch (err) {
        console.error('Failed to load ad costs:', err)
      }
    }

    fetchList()

    return () => {
      cancelled = true
    }
  }, [])

  // Load products
  useEffect(() => {
    let cancelled = false

    async function fetchProducts() {
      try {
        const data = await api('/products/admin/all?limit=100')
        if (!cancelled) setProducts(data.items || [])
      } catch (err) {
        console.error('Failed to load products:', err)
      }
    }

    fetchProducts()

    return () => {
      cancelled = true
    }
  }, [])

  // Load report
  useEffect(() => {
    let cancelled = false

    async function fetchReport() {
      try {
        const data = await api(`/adspend/by-product?days=${days}`)

        if (!cancelled) {
          setReport({
            ...data,
            forDays: days,
          })
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load ad spend report:', err)
        }
      }
    }

    fetchReport()

    return () => {
      cancelled = true
    }
  }, [days, list])

  // Submit ad cost
  async function submit(e) {
    e.preventDefault()
    setError('')

    try {
      await api('/adspend', {
        method: 'POST',
        body: {
          ...f,
          days: Number(f.days),
          amount: Number(f.amount),
          product: f.product || undefined,
        },
      })

      setF((prev) => ({
        ...prev,
        amount: '',
        note: '',
      }))

      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  // Delete ad cost
  async function remove(id) {
    if (!window.confirm('Delete this ad cost entry?')) return

    try {
      await api(`/adspend/${id}`, {
        method: 'DELETE',
      })

      await load()
    } catch (err) {
      window.alert(err.message)
    }
  }

  // Calculate spending this month
  const month = qDate().slice(0, 7)

  const thisMonth = list.reduce((sum, a) => {
    const start = qDate(a.startDate)
    if (!start || !a.days || !Number.isFinite(Number(a.amount))) {
      return sum
    }

    let total = 0

    for (let i = 0; i < Number(a.days); i++) {
      if (addDays(start, i).startsWith(month)) {
        total += Number(a.amount) / Number(a.days)
      }
    }

    return sum + total
  }, 0)

  const ready = report && report.forDays === days

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">
        Ads &amp; costs
      </h1>

      <p className="mb-5 text-sm text-gray-500">
        Enter what you spent on ads. Choose 7 days to enter a weekly
        total, or 1 day for a daily amount. It is spread evenly across
        those days. Pick a <b>product</b> when the ad promotes one
        product, so you can see the ad cost per unit below.
      </p>

      {/* Add ad cost form */}
      <form
        onSubmit={submit}
        className="mb-6 rounded-2xl border bg-white p-5 shadow-sm"
      >
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              Start date
            </span>
            <input
              type="date"
              required
              className={inputCls}
              value={f.startDate}
              onChange={(e) =>
                setF({ ...f, startDate: e.target.value })
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              Covers (days)
            </span>
            <input
              type="number"
              min="1"
              max="366"
              required
              className={inputCls}
              value={f.days}
              onChange={(e) =>
                setF({ ...f, days: e.target.value })
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              Total amount (QAR)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className={inputCls}
              value={f.amount}
              onChange={(e) =>
                setF({ ...f, amount: e.target.value })
              }
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-xs font-medium">
              Product (optional)
            </span>
            <select
              className={inputCls}
              value={f.product}
              onChange={(e) =>
                setF({ ...f, product: e.target.value })
              }
            >
              <option value="">
                Not for one product (general)
              </option>

              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name?.en || 'Unnamed product'}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              Platform
            </span>
            <input
              className={inputCls}
              value={f.platform}
              onChange={(e) =>
                setF({ ...f, platform: e.target.value })
              }
            />
          </label>

          <label className="block lg:col-span-6">
            <span className="mb-1 block text-xs font-medium">
              Note (optional)
            </span>
            <input
              className={inputCls}
              value={f.note}
              onChange={(e) =>
                setF({ ...f, note: e.target.value })
              }
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-4 rounded-lg bg-gray-900 px-5 py-2 text-white hover:bg-gray-700"
        >
          Add ad cost
        </button>
      </form>

      {/* Ad cost per product and per unit */}
      <section className="mb-8 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            Ad cost per product and per unit
          </h2>

          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  days === d
                    ? 'bg-gray-900 text-white'
                    : 'border hover:bg-gray-100'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {!ready && (
          <p className="text-sm text-gray-500">
            Loading…
          </p>
        )}

        {ready && report.rows.length === 0 && (
          <p className="text-sm text-gray-500">
            No ad costs assigned to a product, and no sales in this
            period yet.
          </p>
        )}

        {ready && report.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="py-2 text-start">Product</th>
                  <th className="text-end">Ad spend</th>
                  <th className="text-end">Units sold</th>
                  <th className="text-end">Orders</th>
                  <th className="text-end">Ad cost / unit</th>
                  <th className="text-end">Ad cost / order</th>
                  <th className="text-end">Profit after ads</th>
                  <th className="text-end">Profit / unit</th>
                </tr>
              </thead>

              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="text-end">{money(r.spend)}</td>
                    <td className="text-end">{r.units}</td>
                    <td className="text-end">{r.orders}</td>
                    <td className="text-end font-semibold">
                      {dash(r.adPerUnit)}
                    </td>
                    <td className="text-end">
                      {dash(r.adPerOrder)}
                    </td>
                    <td
                      className={`text-end font-semibold ${
                        r.profit >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {money(r.profit)}
                    </td>
                    <td className="text-end">
                      {dash(r.profitPerUnit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ready && (
          <p className="mt-3 text-xs text-gray-500">
            Units and revenue count paid items in orders placed in
            the period that were not cancelled or returned (free
            gifts are not counted). Profit = revenue − product cost
            − ad spend, before delivery costs.
            {report.unassigned > 0 &&
              ` Ad spend not assigned to a product in this period: ${money(report.unassigned)}.`}
          </p>
        )}
      </section>

      {/* Monthly spending */}
      <div className="mb-3 text-sm text-gray-600">
        Spent this month:{' '}
        <b>{money(Math.round(thisMonth * 100) / 100)}</b>
      </div>

      {/* Ad cost history */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {list.length === 0 && (
          <div className="p-6 text-gray-500">
            No ad costs yet.
          </div>
        )}

        <ul className="divide-y">
          {list.map((a) => {
            const start = qDate(a.startDate)

            return (
              <li
                key={a._id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="font-semibold">
                    {money(a.amount)}{' '}
                    <span className="text-sm font-normal text-gray-500">
                      · {a.platform}
                      {a.product?.name?.en
                        ? ` · ${a.product.name.en}`
                        : ' · general'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    {start} → {addDays(start, a.days - 1)}
                    {' '}({a.days} day{a.days > 1 ? 's' : ''},
                    {' '}about {money(
                      Math.round((a.amount / a.days) * 100) / 100
                    )} per day)
                    {a.note ? ` · ${a.note}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => remove(a._id)}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
