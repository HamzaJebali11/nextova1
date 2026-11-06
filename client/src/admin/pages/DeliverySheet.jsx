
import { useEffect, useMemo, useState } from 'react'
import { Download, MapPin, MessageCircle, Phone } from 'lucide-react'
import { api } from '../../lib/api'
import { downloadFile } from '../../lib/download'
import { addressParts } from '../../lib/address'
import { money } from '../../lib/constants'
import StatusBadge from '../components/StatusBadge'
import { WhatsAppState } from '../components/OrderBadges'

const OPEN_STATUSES = 'new,confirmed,processing,out_for_delivery'

const sum = (list) =>
  list.reduce((total, order) => total + (Number(order.total) || 0), 0)

const num = (a, b) =>
  String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
  })

const itemsText = (order) =>
  (order.items || []).map(
    (item) =>
      `${item.qty} × ${item.name}${
        item.variantName ? ` (${item.variantName})` : ''
      }${item.price === 0 ? ' (free gift)' : ''}`
  )

function mapLink(order) {
  if (order.location?.url) return order.location.url

  const customer = order.customer || {}

  const query = [
    customer.address,
    customer.area,
    customer.zone && `Zone ${customer.zone}`,
    'Qatar',
  ]
    .filter(Boolean)
    .join(' ')

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export default function DeliverySheet() {
  const [data, setData] = useState({
    open: [],
    deliveredToday: [],
  })

  const [loaded, setLoaded] = useState(false)
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [error, setError] = useState('')

  // Load delivery data
  useEffect(() => {
    let cancelled = false

    async function fetchDeliveryData() {
      try {
        const result = await api('/exports/delivery')

        if (!cancelled) {
          setData({
            open: Array.isArray(result.open) ? result.open : [],
            deliveredToday: Array.isArray(result.deliveredToday)
              ? result.deliveredToday
              : [],
          })

          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load delivery orders.')
        }
      } finally {
        if (!cancelled) {
          setLoaded(true)
        }
      }
    }

    fetchDeliveryData()

    return () => {
      cancelled = true
    }
  }, [])

  // Available zones
  const zones = useMemo(
    () =>
      [
        ...new Set(
          data.open
            .map((order) => order.customer?.zone)
            .filter(Boolean)
        ),
      ].sort(num),
    [data.open]
  )

  // Filter and sort orders by zone, street, and building
  const list = useMemo(
    () =>
      data.open
        .filter(
          (order) =>
            (!zone || order.customer?.zone === zone) &&
            (!status || order.status === status)
        )
        .sort(
          (a, b) =>
            num(a.customer?.zone, b.customer?.zone) ||
            num(a.customer?.street, b.customer?.street) ||
            num(a.customer?.building, b.customer?.building) ||
            new Date(a.createdAt) - new Date(b.createdAt)
        ),
    [data.open, zone, status]
  )

  // Update order status
  async function move(order, next) {
    if (
      next === 'returned' &&
      !window.confirm(
        `Mark ${order.orderNumber} as NOT delivered (returned)? Its items go back to stock.`
      )
    ) {
      return
    }

    setBusy(order._id)
    setError('')

    try {
      const updated = await api(`/orders/${order._id}/status`, {
        method: 'PATCH',
        body: { status: next },
      })

      setData((previous) => {
        const merged = {
          ...order,
          status: updated.status,
          deliveredAt: updated.deliveredAt,
        }

        if (next === 'delivered') {
          return {
            open: previous.open.filter((item) => item._id !== order._id),
            deliveredToday: [merged, ...previous.deliveredToday],
          }
        }

        if (['returned', 'cancelled'].includes(next)) {
          return {
            ...previous,
            open: previous.open.filter((item) => item._id !== order._id),
          }
        }

        return {
          ...previous,
          open: previous.open.map((item) =>
            item._id === order._id ? merged : item
          ),
        }
      })
    } catch (err) {
      setError(err.message || 'Failed to update order status.')
    } finally {
      setBusy('')
    }
  }

  // Export open orders
  async function exportOpen() {
    try {
      const params = new URLSearchParams({
        status: OPEN_STATUSES,
      })

      if (zone) {
        params.set('zone', zone)
      }

      await downloadFile(
        `/exports/orders.xlsx?${params.toString()}`,
        `orders-to-deliver${zone ? `-zone${zone}` : ''}.xlsx`
      )
    } catch (err) {
      setError(err.message || 'Failed to export orders.')
    }
  }

  const chip = (active) =>
    `rounded-full px-4 py-1.5 text-sm ${
      active
        ? 'bg-gray-900 text-white'
        : 'border bg-white hover:bg-gray-100'
    }`

  // Build delivery cards
  const cards = []
  let lastZone = null

  for (const order of list) {
    const customer = order.customer || {}
    const phone = (customer.phone || '').replace(/\D/g, '')
    const parts = addressParts(customer)
    const currentZone = customer.zone || ''

    if (currentZone !== lastZone) {
      lastZone = currentZone

      const inZone = list.filter(
        (item) => (item.customer?.zone || '') === currentZone
      )

      cards.push(
        <h2
          key={`zone-${currentZone}`}
          className="sticky top-0 z-10 -mx-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white"
        >
          {currentZone ? `Zone ${currentZone}` : 'No zone'} ·{' '}
          {inZone.length} order(s) · {money(sum(inZone))}
        </h2>
      )
    }

    cards.push(
      <article
        key={order._id}
        className="rounded-2xl border bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{order.orderNumber}</span>
              <StatusBadge status={order.status} />
              <WhatsAppState order={order} />
            </div>

            <div className="mt-1 text-lg font-semibold">
              {customer.name}
            </div>
          </div>

          <div className="text-end">
            <div className="text-xs text-gray-500">
              Amount to collect
            </div>

            <div className="text-2xl font-extrabold text-green-700">
              {money(order.total)}
            </div>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-700">
          <b>{customer.area}</b>

          {parts.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {parts.map((part) => (
                <span
                  key={part}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold"
                >
                  {part}
                </span>
              ))}
            </div>
          )}

          {customer.address && (
            <div className="mt-1">{customer.address}</div>
          )}

          {customer.notes && (
            <div className="italic text-gray-500">
              "{customer.notes}"
            </div>
          )}
        </div>

        <ul className="mt-2 text-sm text-gray-700">
          {itemsText(order).map((line, index) => (
            <li key={index}>• {line}</li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href={`tel:${customer.phone || ''}`}
            className="flex items-center gap-2 rounded-full border px-3 py-2 hover:bg-gray-100"
          >
            <Phone size={16} />
            {customer.phone}
          </a>

          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full bg-[#25D366] px-3 py-2 font-medium text-white hover:brightness-110"
          >
            <MessageCircle size={16} />
            WhatsApp
          </a>

          <a
            href={mapLink(order)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border px-3 py-2 hover:bg-gray-100"
          >
            <MapPin size={16} />
            {order.location?.url ? 'Customer location' : 'Search address'}
          </a>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3 text-sm">
          {order.status !== 'out_for_delivery' && (
            <button
              disabled={busy === order._id}
              onClick={() => move(order, 'out_for_delivery')}
              className="rounded-full border px-4 py-2 font-medium hover:bg-gray-100 disabled:opacity-50"
            >
              Out for delivery
            </button>
          )}

          <button
            disabled={busy === order._id}
            onClick={() => move(order, 'delivered')}
            className="rounded-full bg-green-600 px-5 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            ✓ Delivered
          </button>

          <button
            disabled={busy === order._id}
            onClick={() => move(order, 'returned')}
            className="rounded-full border px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Not delivered
          </button>
        </div>
      </article>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Delivery sheet</h1>

          <p className="text-sm text-gray-500">
            Open orders grouped by zone. Mark each one when you deliver it.
          </p>
        </div>

        <button
          onClick={exportOpen}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <Download size={16} />
          Export to Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['To deliver', list.length],
          ['To collect', money(sum(list))],
          ['Delivered today', data.deliveredToday.length],
          ['Collected today', money(sum(data.deliveredToday))],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border bg-white p-4 text-center shadow-sm"
          >
            <div className="text-xl font-extrabold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatus('')}
          className={chip(!status)}
        >
          All open
        </button>

        <button
          onClick={() => setStatus('confirmed')}
          className={chip(status === 'confirmed')}
        >
          Confirmed
        </button>

        <button
          onClick={() => setStatus('out_for_delivery')}
          className={chip(status === 'out_for_delivery')}
        >
          Out for delivery
        </button>

        <select
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          className="ms-auto rounded-full border bg-white px-4 py-2 text-sm outline-none"
        >
          <option value="">All zones</option>

          {zones.map((item) => (
            <option key={item} value={item}>
              Zone {item}
            </option>
          ))}
        </select>
      </div>

      {/* Error and loading states */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loaded && (
        <div className="p-6 text-gray-500">Loading…</div>
      )}

      {loaded && list.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">
          Nothing to deliver right now. 🎉
        </div>
      )}

      {/* Delivery cards */}
      <div className="space-y-3">{cards}</div>

      {/* Delivered orders */}
      {data.deliveredToday.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowDone((previous) => !previous)}
            className="mb-3 text-sm font-semibold text-gray-700 underline"
          >
            {showDone ? 'Hide' : 'Show'} delivered today (
            {data.deliveredToday.length} ·{' '}
            {money(sum(data.deliveredToday))})
          </button>

          {showDone && (
            <ul className="divide-y rounded-2xl border bg-white">
              {data.deliveredToday.map((order) => (
                <li
                  key={order._id}
                  className="flex items-center justify-between p-3 text-sm text-gray-500 line-through"
                >
                  <span>
                    {order.orderNumber} · {order.customer?.name} ·{' '}
                    {order.customer?.area}
                    {order.customer?.zone
                      ? ` · Zone ${order.customer.zone}`
                      : ''}
                  </span>

                  <span>{money(order.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
