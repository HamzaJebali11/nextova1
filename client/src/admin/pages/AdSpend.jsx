import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'

const inputCls =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

const today = qDate(new Date())

function qDate(d) {
  return new Date(
    new Date(d).getTime() + 3 * 3600 * 1000
  )
    .toISOString()
    .slice(0, 10)
}

const addDays = (key, n) =>
  new Date(
    Date.parse(`${key}T00:00:00Z`) + n * 86400000
  )
    .toISOString()
    .slice(0, 10)

export default function AdSpend() {
  const [list, setList] = useState([])

  const [f, setF] = useState({
    startDate: today,
    days: 7,
    amount: '',
    platform: 'Facebook',
    note: '',
  })

  const [error, setError] = useState('')

  const load = () =>
    api('/adspend').then(setList)

  useEffect(() => {
    load().catch(() => {})
  }, [])

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
        },
      })

      setF({
        ...f,
        amount: '',
        note: '',
      })

      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this ad cost entry?')) return

    try {
      await api(`/adspend/${id}`, {
        method: 'DELETE',
      })

      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const month = today.slice(0, 7)

  const thisMonth = list.reduce((sum, a) => {
    const start = qDate(a.startDate)

    let s = 0

    for (let i = 0; i < a.days; i++) {
      if (addDays(start, i).startsWith(month)) {
        s += a.amount / a.days
      }
    }

    return sum + s
  }, 0)

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">
        Ads &amp; costs
      </h1>

      <p className="mb-5 text-sm text-gray-500">
        Enter what you spent on ads. Choose 7 days to enter
        a weekly total, or 1 day for a daily amount. It is
        spread evenly across those days in your profit
        charts. Your cost per product is set in Products,
        and your delivery cost per order in Settings.
      </p>

      <form
        onSubmit={submit}
        className="mb-6 rounded-2xl border bg-white p-5 shadow-sm"
      >
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                setF({
                  ...f,
                  startDate: e.target.value,
                })
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
                setF({
                  ...f,
                  days: e.target.value,
                })
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
                setF({
                  ...f,
                  amount: e.target.value,
                })
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              Platform
            </span>

            <input
              className={inputCls}
              value={f.platform}
              onChange={(e) =>
                setF({
                  ...f,
                  platform: e.target.value,
                })
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              Note (optional)
            </span>

            <input
              className={inputCls}
              value={f.note}
              onChange={(e) =>
                setF({
                  ...f,
                  note: e.target.value,
                })
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

      <div className="mb-3 text-sm text-gray-600">
        Spent this month:{' '}
        <b>
          {money(
            Math.round(thisMonth * 100) / 100
          )}
        </b>
      </div>

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
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    {start} →{' '}
                    {addDays(start, a.days - 1)} (
                    {a.days} day
                    {a.days > 1 ? 's' : ''}, about{' '}
                    {money(
                      Math.round(
                        (a.amount / a.days) * 100
                      ) / 100
                    )}{' '}
                    per day)
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