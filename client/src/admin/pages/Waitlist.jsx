import { Fragment, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { fmtDate } from '../../lib/constants'
import { WhatsAppIcon } from '../../store/components/icons'
import { FilterChip, ListTable, PageHeader, SearchBox, Tag, Th, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'

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
  const [show, setShow] = useState('all') // all | ready | waiting
  const [q, setQ] = useState('')
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

  const all = groups || []
  const readyCount = all.reduce((n, g) => n + g.alerts.filter((a) => a.available).length, 0)
  const waitingCount = all.reduce((n, g) => n + g.alerts.filter((a) => !a.available).length, 0)
  const needle = q.trim().toLowerCase()
  const shown = all
    .map((g) => ({
      ...g,
      alerts: g.alerts.filter((a) =>
        (show === 'all' || (show === 'ready' ? a.available : !a.available)) &&
        (!needle || a.phone.includes(needle) || (g.product.name?.en || '').toLowerCase().includes(needle) || (a.variantName || '').toLowerCase().includes(needle))
      ),
    }))
    .filter((g) => g.alerts.length > 0)

  return (
    <div>
      <PageHeader
        title="Waiting list"
        subtitle="Customers who left their WhatsApp number on a sold-out product. When you restock it, the red badge shows how many to message. Notify sends each one a ready message and takes them off the list."
      />

      <Toolbar>
        <FilterChip active={show === 'all'} onClick={() => setShow('all')} count={readyCount + waitingCount}>All</FilterChip>
        <FilterChip active={show === 'ready'} onClick={() => setShow('ready')} count={readyCount} alert>Back in stock: notify</FilterChip>
        <FilterChip active={show === 'waiting'} onClick={() => setShow('waiting')} count={waitingCount}>Still sold out</FilterChip>
        <SearchBox value={q} onChange={setQ} placeholder="Phone, product or option" className="w-full md:ms-auto md:w-64" />
      </Toolbar>

      <ListTable colSpan={4} loading={!groups} empty={groups && shown.length === 0 && 'Nobody is waiting here right now.'} minWidth="40rem"
        head={<><Th>Customer</Th><Th>Option · language</Th><Th>Since</Th><Th end>Actions</Th></>}>
        {shown.map((g) => {
          const ready = g.alerts.filter((a) => a.available).length
          return (
            <Fragment key={g.product._id}>
              <tr className="bg-gray-50">
                <td colSpan={4} className="p-3">
                  <div className="flex items-center gap-3">
                    {g.product.image && <img src={optimizeImg(g.product.image, 96)} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                    <span className="font-semibold">{g.product.name?.en}</span>
                    <span className="text-xs text-gray-500">{g.alerts.length} waiting</span>
                    <Tag tone={ready ? 'ink' : 'muted'} className="ms-auto">{ready ? `Back in stock: ${ready} to notify` : 'Still sold out'}</Tag>
                  </div>
                </td>
              </tr>
              {g.alerts.map((a) => (
                <tr key={a._id}>
                  <td className="p-3 font-medium" dir="ltr">{a.phone}</td>
                  <td className="p-3 text-gray-700">{a.variantName || '–'} · {a.lang === 'ar' ? 'Arabic' : 'English'}</td>
                  <td className="p-3 text-xs text-gray-500">{fmtDate(a.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button disabled={!a.available} onClick={() => notify(g.product, a)} className={btn.whatsapp}
                        title={a.available ? 'Send the back-in-stock message' : 'Still sold out'}>
                        <WhatsAppIcon size={15} /> Notify
                      </button>
                      <button onClick={() => remove(a._id)} className={btn.danger} aria-label={`Remove ${a.phone}`}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </Fragment>
          )
        })}
      </ListTable>
    </div>
  )
}
