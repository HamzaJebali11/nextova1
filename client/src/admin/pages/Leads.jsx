import { useEffect, useState } from 'react'
import { Phone, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'
import { WhatsAppIcon } from '../../store/components/icons'

const TABS = [
  ['new', 'To follow up'],
  ['contacted', 'Contacted'],
  ['ordered', 'Ordered'],
  ['ignored', 'Ignored'],
  ['all', 'All'],
]

function ago(date) {
  const mins = Math.max(
    1,
    Math.round(
      (Date.now() - new Date(date).getTime()) / 60000
    )
  )

  if (mins < 60) return `${mins} min ago`
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`

  return `${Math.round(mins / 1440)} d ago`
}

function message(lead, lang, store) {
  const list = lead.items
    .map(
      (i) =>
        `${i.qty} × ${i.name}${
          i.variantName ? ` (${i.variantName})` : ''
        }`
    )
    .join(', ')

  const name = lead.name ? ` ${lead.name}` : ''

  return lang === 'ar'
    ? `مرحبًا${name}، معك ${store}. لاحظنا أنك كنت تطلب ${list} من موقعنا ولم تكمل الطلب. هل تحتاج أي مساعدة، أو تحب أن نكمل لك الطلب؟ (الدفع عند الاستلام)`
    : `Hello${name}, this is ${store}. We noticed you were ordering ${list} on our website but did not finish. Can we help, or would you like us to place the order for you? (Cash on delivery)`
}

export default function Leads() {
  const [tab, setTab] = useState('new')
  const [page, setPage] = useState(1)

  const [data, setData] = useState({
    items: [],
    pages: 1,
    total: 0,
    newCount: 0,
  })

  const [store, setStore] = useState('Nextova')

  // Load leads whenever tab/page changes.
  useEffect(() => {
    let cancelled = false

    async function fetchLeads() {
      try {
        const result = await api(
          `/leads?status=${tab}&page=${page}`
        )

        if (!cancelled) {
          setData(result)
        }
      } catch {
        // Ignore loading errors here.
      }
    }

    fetchLeads()

    return () => {
      cancelled = true
    }
  }, [tab, page])

  // Load store settings once.
  useEffect(() => {
    let cancelled = false

    async function fetchSettings() {
      try {
        const settings = await api('/settings')

        if (
          !cancelled &&
          settings.storeName
        ) {
          setStore(settings.storeName)
        }
      } catch {
        // Keep default store name.
      }
    }

    fetchSettings()

    return () => {
      cancelled = true
    }
  }, [])

  async function setStatus(id, status) {
    try {
      await api(`/leads/${id}/status`, {
        method: 'PATCH',
        body: { status },
      })

      // Reload the current page after changing status.
      const result = await api(
        `/leads?status=${tab}&page=${page}`
      )

      setData(result)
    } catch (e) {
      alert(e.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this lead?')) return

    try {
      await api(`/leads/${id}`, {
        method: 'DELETE',
      })

      // Reload the current page after deletion.
      const result = await api(
        `/leads?status=${tab}&page=${page}`
      )

      setData(result)
    } catch (e) {
      alert(e.message)
    }
  }

  function chat(lead, lang) {
    const phone = lead.phone.replace(/\D/g, '')

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(
        message(lead, lang, store)
      )}`,
      '_blank',
      'noopener'
    )

    if (lead.status === 'new') {
      setStatus(lead._id, 'contacted')
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">
        Unfinished orders
      </h1>

      <p className="mb-5 text-sm text-gray-500">
        People who typed their phone number but did not
        place the order. Message them quickly: a short,
        helpful WhatsApp often turns them into orders.
        Leads delete themselves 30 days after their last
        activity, and become "Ordered" automatically if
        they order.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setTab(value)
              setPage(1)
            }}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === value
                ? 'bg-gray-900 text-white'
                : 'border bg-white hover:bg-gray-100'
            }`}
          >
            {label}

            {value === 'new' &&
              data.newCount > 0 &&
              ` (${data.newCount})`}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {data.items.length === 0 && (
          <div className="p-6 text-gray-500">
            Nothing here.
          </div>
        )}

        <ul className="divide-y">
          {data.items.map((l) => (
            <li
              key={l._id}
              className="p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {l.name || 'No name yet'} ·{' '}
                    <span dir="ltr">
                      {l.phone}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    {[l.area, ago(l.updatedAt)]
                      .filter(Boolean)
                      .join(' · ')}

                    {l.utm?.campaign
                      ? ` · ad: ${l.utm.campaign}`
                      : ''}
                  </div>
                </div>

                <div className="text-end">
                  {l.total !== undefined && (
                    <div className="font-semibold">
                      {money(l.total)}
                    </div>
                  )}

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      l.status === 'new'
                        ? 'bg-amber-100 text-amber-700'
                        : l.status === 'ordered'
                          ? 'bg-green-100 text-green-700'
                          : l.status === 'contacted'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {l.status}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-sm text-gray-700">
                {l.items.map((i, idx) => (
                  <span key={idx}>
                    {idx > 0 ? ', ' : ''}
                    {i.qty} × {i.name}
                    {i.variantName
                      ? ` (${i.variantName})`
                      : ''}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <button
                  onClick={() =>
                    chat(l, 'en')
                  }
                  className="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 font-semibold text-white hover:brightness-110"
                >
                  <WhatsAppIcon size={16} />
                  WhatsApp (English)
                </button>

                <button
                  onClick={() =>
                    chat(l, 'ar')
                  }
                  className="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 font-semibold text-white hover:brightness-110"
                >
                  <WhatsAppIcon size={16} />
                  واتساب (عربي)
                </button>

                <a
                  href={`tel:${l.phone}`}
                  className="flex items-center gap-2 rounded-full border px-4 py-2 hover:bg-gray-100"
                >
                  <Phone size={16} />
                  Call
                </a>

                {l.status !== 'ignored' && (
                  <button
                    onClick={() =>
                      setStatus(
                        l._id,
                        'ignored'
                      )
                    }
                    className="rounded-full border px-4 py-2 hover:bg-gray-100"
                  >
                    Ignore
                  </button>
                )}

                {l.status !== 'new' && (
                  <button
                    onClick={() =>
                      setStatus(
                        l._id,
                        'new'
                      )
                    }
                    className="rounded-full border px-4 py-2 hover:bg-gray-100"
                  >
                    Back to follow-up
                  </button>
                )}

                <button
                  onClick={() =>
                    remove(l._id)
                  }
                  className="flex items-center gap-1 rounded-full border px-4 py-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {data.total} lead(s)
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() =>
              setPage(page - 1)
            }
            className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>

          <span>
            {page} / {data.pages || 1}
          </span>

          <button
            disabled={page >= data.pages}
            onClick={() =>
              setPage(page + 1)
            }
            className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}