import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Phone, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money, fmtDate } from '../../lib/constants'
import { WhatsAppIcon } from '../../store/components/icons'
import { FilterChip, ListTable, PageHeader, Pager, SearchBox, SidePanel, Tag, Th, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'

const TABS = [
  ['new', 'To follow up'],
  ['contacted', 'Contacted'],
  ['ordered', 'Ordered'],
  ['ignored', 'Ignored'],
  ['all', 'All'],
]
const TONE = { new: 'ink', contacted: 'soft', ordered: 'outline', ignored: 'muted' }

function ago(date) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000))
  if (mins < 60) return `${mins} min ago`
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`
  return `${Math.round(mins / 1440)} d ago`
}

const itemsText = (lead) =>
  lead.items.map((i) => `${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ')

function message(lead, lang, store) {
  const list = itemsText(lead)
  const name = lead.name ? ` ${lead.name}` : ''
  return lang === 'ar'
    ? `مرحبًا${name}، معك ${store}. لاحظنا أنك كنت تطلب ${list} من موقعنا ولم تكمل الطلب. هل تحتاج أي مساعدة، أو تحب أن نكمل لك الطلب؟ (الدفع عند الاستلام)`
    : `Hello${name}, this is ${store}. We noticed you were ordering ${list} on our website but did not finish. Can we help, or would you like us to place the order for you? (Cash on delivery)`
}

export default function Leads() {
  const [tab, setTab] = useState('new')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [data, setData] = useState({ items: [], pages: 1, total: 0, newCount: 0 })
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState('Nextova')
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: tab, page })
    if (q.trim()) params.set('q', q.trim())
    setLoading(true)
    try {
      setData(await api(`/leads?${params}`))
    } catch {
      // keep the current list
    } finally {
      setLoading(false)
    }
  }, [tab, page, q])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    api('/settings').then((s) => s.storeName && setStore(s.storeName)).catch(() => {})
  }, [])

  async function setStatus(lead, status) {
    try {
      const updated = await api(`/leads/${lead._id}/status`, { method: 'PATCH', body: { status } })
      if (open?._id === lead._id) setOpen({ ...open, status: updated.status })
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  async function remove(lead) {
    if (!confirm('Delete this lead?')) return
    try {
      await api(`/leads/${lead._id}`, { method: 'DELETE' })
      setOpen(null)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  function chat(lead, lang) {
    const phone = lead.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message(lead, lang, store))}`, '_blank', 'noopener')
    if (lead.status === 'new') setStatus(lead, 'contacted')
  }

  const actions = (l) => (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => chat(l, 'en')} className={btn.whatsapp}><WhatsAppIcon size={15} /> WhatsApp (English)</button>
      <button onClick={() => chat(l, 'ar')} className={btn.whatsapp}><WhatsAppIcon size={15} /> واتساب (عربي)</button>
      <a href={`tel:${l.phone}`} className={btn.ghost}><Phone size={15} /> Call</a>
      {l.status !== 'ignored' && <button onClick={() => setStatus(l, 'ignored')} className={btn.ghost}>Ignore</button>}
      {l.status !== 'new' && <button onClick={() => setStatus(l, 'new')} className={btn.ghost}>Back to follow-up</button>}
      <button onClick={() => remove(l)} className={btn.danger}><Trash2 size={14} /> Delete</button>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Unfinished orders"
        subtitle={'People who typed their phone number but did not place the order. A short, helpful WhatsApp often turns them into orders. Leads delete themselves 30 days after their last activity, and become "Ordered" automatically if they order.'}
      />

      <Toolbar>
        {TABS.map(([value, label]) => (
          <FilterChip key={value} active={tab === value} onClick={() => { setTab(value); setPage(1) }}
            count={value === 'new' ? data.newCount : 0} alert={value === 'new'}>
            {label}
          </FilterChip>
        ))}
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Name or phone" className="w-full md:ms-auto md:w-64" />
      </Toolbar>

      <ListTable colSpan={6} loading={loading && data.items.length === 0} empty={data.items.length === 0 && 'Nothing here.'} minWidth="56rem"
        head={<><Th>Customer</Th><Th>Items</Th><Th>Area · last activity</Th><Th end>Total</Th><Th>Status</Th><Th end><span className="sr-only">WhatsApp</span></Th></>}>
        {data.items.map((l) => (
          <tr key={l._id} onClick={() => setOpen(l)} className="cursor-pointer align-top hover:bg-gray-50">
            <td className="p-3">
              <div className="font-semibold">{l.name || 'No name yet'}</div>
              <div className="text-xs text-gray-500" dir="ltr">{l.phone}</div>
            </td>
            <td className="max-w-[18rem] p-3"><div className="line-clamp-2">{itemsText(l)}</div></td>
            <td className="p-3 text-gray-700">
              {l.area || '–'}
              <div className="text-xs text-gray-500">{ago(l.updatedAt)}</div>
              {(l.utm?.campaign || l.angle?.slug) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {l.utm?.campaign && <Tag tone="muted">ad: {l.utm.campaign}</Tag>}
                  {l.angle?.slug && <Tag tone="muted">angle: {l.angle.slug}</Tag>}
                </div>
              )}
            </td>
            <td className="p-3 text-end font-semibold">{l.total !== undefined ? money(l.total) : '–'}</td>
            <td className="p-3"><Tag tone={TONE[l.status]}>{l.status}</Tag></td>
            <td className="p-3 text-end" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => chat(l, 'en')} aria-label={`WhatsApp ${l.name || l.phone}`} title="WhatsApp (English)"
                className="inline-grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white hover:brightness-110">
                <WhatsAppIcon size={18} />
              </button>
            </td>
          </tr>
        ))}
      </ListTable>

      <Pager page={page} pages={data.pages} total={data.total} label="lead(s)" onPage={setPage} />

      <AnimatePresence>
        {open && (
          <SidePanel key={open._id} title={open.name || open.phone} onClose={() => setOpen(null)}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Tag tone={TONE[open.status]}>{open.status}</Tag>
              {open.utm?.campaign && <Tag tone="muted">ad: {open.utm.campaign}</Tag>}
              {open.angle?.slug && <Tag tone="muted">angle: {open.angle.slug}</Tag>}
            </div>
            <dl className="mb-5 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Phone</dt><dd dir="ltr" className="font-semibold">{open.phone}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Area</dt><dd>{open.area || '–'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Last activity</dt><dd>{fmtDate(open.updatedAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Cart total</dt><dd className="font-semibold">{open.total !== undefined ? money(open.total) : '–'}</dd></div>
            </dl>
            <h3 className="mb-2 font-semibold">Items</h3>
            <ul className="mb-5 divide-y text-sm">
              {open.items.map((i, idx) => <li key={idx} className="py-2">{i.qty} × {i.name}{i.variantName ? ` (${i.variantName})` : ''}</li>)}
            </ul>
            {actions(open)}
          </SidePanel>
        )}
      </AnimatePresence>
    </div>
  )
}
