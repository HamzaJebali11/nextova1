import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { fmtDate } from '../../lib/constants'
import { WhatsAppIcon } from '../../store/components/icons'

function message(product, item) {
  const link = `${window.location.origin}/product/${product.slug}${item.lang === 'ar' ? '?lang=ar' : ''}`
  const name = item.lang === 'ar' ? product.name?.ar || product.name?.en : product.name?.en
  return item.lang === 'ar'
    ? `مرحبًا! خبر سار: "${name}" عاد للمخزون. اطلبه الآن قبل أن تنفد الكمية: ${link}`
    : `Hello! Good news: "${name}" is back in stock. Order here before it sells out: ${link}`
}

export default function Waitlist() {
  const [groups, setGroups] = useState(null)
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)

  useEffect(() => {
    let cancelled = false
    api('/alerts')
      .then((d) => { if (!cancelled) setGroups(d) })
      .catch(() => { if (!cancelled) setGroups([]) })
    return () => { cancelled = true }
  }, [version])

  async function notify(product, item) {
    const phone = item.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message(product, item))}`, '_blank', 'noopener')
    try {
      await api(`/alerts/${item._id}/notified`, { method: 'PATCH' })
      reload()
    } catch (e) {
      window.alert(e.message)
    }
  }

  async function remove(id) {
    if (!window.confirm('Remove this person from the list?')) return
    try {
      await api(`/alerts/${id}`, { method: 'DELETE' })
      reload()
    } catch (e) {
      window.alert(e.message)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Waiting list</h1>
      <p className="mb-5 text-sm text-gray-500">
        Customers who left their WhatsApp number on a sold-out product. When you restock it, the red circle shows how many to message.
        Tap Notify to send each one a ready message, and they leave the list automatically.
      </p>

      {!groups && <div className="p-6 text-gray-500">Loading…</div>}
      {groups?.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">Nobody is waiting for a product right now.</div>
      )}

      <div className="space-y-4">
        {groups?.map((g) => {
          const ready = g.alerts.filter((a) => a.available).length
          return (
            <section key={g.product._id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                {g.product.image && <img src={optimizeImg(g.product.image, 120)} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                <div className="flex-1">
                  <div className="font-semibold">{g.product.name?.en}</div>
                  <div className="text-xs text-gray-500">{g.alerts.length} waiting</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${ready ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {ready ? `Back in stock: ${ready} to notify` : 'Still sold out'}
                </span>
              </div>

              <ul className="divide-y text-sm">
                {g.alerts.map((a) => (
                  <li key={a._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <span dir="ltr" className="font-medium">{a.phone}</span>
                      {a.variantName && <span className="text-gray-500"> · {a.variantName}</span>}
                      <span className="text-xs text-gray-400"> · {fmtDate(a.createdAt)} · {a.lang === 'ar' ? 'Arabic' : 'English'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button disabled={!a.available} onClick={() => notify(g.product, a)}
                        className="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-1.5 font-semibold text-white hover:brightness-110 disabled:opacity-40">
                        <WhatsAppIcon size={16} /> Notify
                      </button>
                      <button onClick={() => remove(a._id)} className="rounded-full border p-2 text-red-600 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}