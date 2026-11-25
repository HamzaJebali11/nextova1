import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Ban, Download, Plus } from 'lucide-react'
import { api } from '../../lib/api'
import { downloadFile } from '../../lib/download'
import { money, fmtDay, reasonLabel } from '../../lib/constants'
import { normalizeQatarPhone, waDigits } from '../../lib/phone'
import { FilterChip, ListTable, PageHeader, Pager, SearchBox, SidePanel, Tag, Th, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'
import StatusBadge from '../components/StatusBadge'
import { WhatsAppIcon } from '../../store/components/icons'

const FILTERS = [
  ['', 'All customers'], ['repeat', 'Repeat buyers'], ['failed', 'Has failed orders'], ['blocked', 'Blocked'], ['inactive', 'Not ordered in 30+ days'],
]
const SORTS = [
  ['last', 'Last order'], ['orders', 'Most orders'], ['spent', 'Total spent'], ['failed', 'Most failed'], ['first', 'First order'], ['name', 'Name'],
]

function CustomerPanel({ k, onClose, onChanged }) {
  const [d, setD] = useState(null)
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [blockNote, setBlockNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    api(`/customers/${k}`).then((x) => {
      if (cancelled) return
      setD(x)
      setNotes(x.meta?.notes || '')
      setTags((x.meta?.tags || []).join(', '))
    }).catch((e) => setMsg(e.message))
    return () => { cancelled = true }
  }, [k])

  async function save(patch) {
    setBusy(true)
    setMsg('')
    try {
      const meta = await api(`/customers/${k}`, { method: 'PATCH', body: patch })
      setD((x) => ({ ...x, meta }))
      setMsg('Saved ✓')
      onChanged()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const s = d?.summary
  return (
    <SidePanel title={d?.name || d?.phone || 'Customer'} onClose={onClose}>
      {!d && <p className="text-gray-500">{msg || 'Loading…'}</p>}
      {d && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span dir="ltr" className="font-semibold">{d.phone}</span>
            {d.meta?.blocked && <Tag tone="danger"><Ban size={12} /> Blocked</Tag>}
            {d.meta?.optOut && <Tag tone="muted">Opted out</Tag>}
            <a href={`https://wa.me/${waDigits(d.phone)}`} target="_blank" rel="noreferrer" className={`${btn.whatsapp} ms-auto`}><WhatsAppIcon size={14} /> WhatsApp</a>
          </div>
          {s && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['Orders', s.orders], ['Delivered', s.delivered], ['Failed', s.failed], ['Cancelled', s.cancelled], ['Spent', money(s.spent)], ['Average', money(s.avg)]].map(([l, v]) => (
                <div key={l} className="rounded-xl border p-2"><div className="font-bold">{v}</div><div className="text-xs text-gray-500">{l}</div></div>
              ))}
            </div>
          )}
          <section>
            <h3 className="mb-1 font-semibold">Orders</h3>
            <ul className="divide-y rounded-xl border">
              {d.orders.map((o) => (
                <li key={o._id} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{o.orderNumber}</b>
                    <span className="text-xs text-gray-500">{fmtDay(o.createdAt)}</span>
                    <StatusBadge status={o.status} />
                    <span className="ms-auto">{money(o.total)}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {o.items.filter((i) => i.price > 0).map((i) => `${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`).join(' · ')}
                    {o.customer?.zone ? ` · Zone ${o.customer.zone}` : ''}
                  </div>
                  {o.failure?.reason && <div className="text-xs text-red-700">Failed: {reasonLabel(o.failure.reason)}{o.failure.note ? ` (${o.failure.note})` : ''}</div>}
                </li>
              ))}
              {d.orders.length === 0 && <li className="px-3 py-2 text-gray-500">No order yet.</li>}
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Notes and tags</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} aria-label="Notes"
              className="w-full rounded-lg border p-2 outline-none focus:ring-2 focus:ring-gray-900" placeholder="Private notes about this customer" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} aria-label="Tags" placeholder="Tags, separated by commas (e.g. VIP, wholesale)"
              className="w-full rounded-lg border px-2 py-1.5 outline-none focus:ring-2 focus:ring-gray-900" />
            <button disabled={busy} onClick={() => save({ notes, tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20) })} className={btn.save}>Save notes and tags</button>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Messages and block list</h3>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!d.meta?.optOut} disabled={busy} onChange={(e) => save({ optOut: e.target.checked })} />
              Opted out (do not send marketing messages)
            </label>
            {d.meta?.blocked ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2">
                <span className="text-red-800">Blocked{d.meta.blockNote ? `: ${d.meta.blockNote}` : ''}{d.meta.blockedBy ? ` · by ${d.meta.blockedBy}` : ''}</span>
                <button disabled={busy} onClick={() => save({ blocked: false })} className={`${btn.ghost} ms-auto`}>Unblock</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={blockNote} onChange={(e) => setBlockNote(e.target.value)} maxLength={300} placeholder="Why block? (note)" aria-label="Block note"
                  className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 outline-none focus:ring-2 focus:ring-gray-900" />
                <button disabled={busy} onClick={() => save({ blocked: true, blockNote: blockNote.trim() })} className={btn.danger}><Ban size={14} /> Block</button>
              </div>
            )}
            <p className="text-xs text-gray-500">A blocked phone can still order (it is never refused); its new orders get the red "Blocked" flag.</p>
          </section>
          {msg && <p className="text-sm text-gray-600" role="status">{msg}</p>}
        </div>
      )}
    </SidePanel>
  )
}

export default function Customers() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState('last')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState(() => params.get('open') || null)
  const [blockPhone, setBlockPhone] = useState('')
  const [blockMsg, setBlockMsg] = useState('')
  const [exporting, setExporting] = useState(false)

  const query = useCallback(() => {
    const p = new URLSearchParams({ sort })
    if (q.trim()) p.set('q', q.trim())
    if (filter) p.set('filter', filter)
    return p
  }, [q, filter, sort])

  const load = useCallback(async () => {
    setLoading(true)
    const p = query()
    p.set('page', page)
    try {
      setData(await api(`/customers?${p}`))
    } finally {
      setLoading(false)
    }
  }, [query, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  function close() {
    setOpenKey(null)
    if (params.get('open')) { const n = new URLSearchParams(params); n.delete('open'); setParams(n, { replace: true }) }
  }

  async function addBlock(e) {
    e.preventDefault()
    setBlockMsg('')
    const n = normalizeQatarPhone(blockPhone)
    if (!n && blockPhone.replace(/\D/g, '').length < 8) return setBlockMsg('Enter a phone number.')
    try {
      await api('/customers/block', { method: 'POST', body: { phone: n || blockPhone } })
      setBlockPhone('')
      setBlockMsg(`${n || blockPhone} blocked ✓`)
      load()
    } catch (err) {
      setBlockMsg(err.message)
    }
  }

  async function exportExcel() {
    setExporting(true)
    try { await downloadFile(`/customers/export.xlsx?${query()}`, 'customers.xlsx') } catch (e) { alert(e.message) } finally { setExporting(false) }
  }

  return (
    <div>
      <PageHeader title="Customers" subtitle="Built from your orders, grouped by mobile number (older number formats are matched too). Spent = delivered orders only."
        actions={<button onClick={exportExcel} disabled={exporting} className={btn.dark}><Download size={15} /> {exporting ? 'Preparing…' : 'Export to Excel'}</button>} />

      <Toolbar>
        {FILTERS.map(([v, l]) => <FilterChip key={v || 'all'} active={filter === v} onClick={() => { setFilter(v); setPage(1) }}>{l}</FilterChip>)}
      </Toolbar>
      <Toolbar>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Name or phone" />
        <label className="flex items-center gap-2 text-sm text-gray-600">Sort
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} className="min-h-10 rounded-lg border bg-white px-2 text-sm">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <form onSubmit={addBlock} className="flex items-center gap-2 md:ms-auto">
          <input value={blockPhone} onChange={(e) => setBlockPhone(e.target.value)} placeholder="Block a phone" aria-label="Phone to block" dir="ltr" inputMode="tel"
            className="min-h-10 w-40 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-gray-900" />
          <button className={btn.danger}><Plus size={14} /> Block</button>
        </form>
      </Toolbar>
      {blockMsg && <p className="mb-2 text-sm text-gray-600" role="status">{blockMsg}</p>}

      <ListTable loading={loading && data.items.length === 0} empty={!loading && data.items.length === 0 ? 'No customers for these filters.' : null} colSpan={10} minWidth="68rem"
        head={<>
          <Th>Name</Th><Th>Phone</Th><Th end>Orders</Th><Th end>Delivered</Th><Th end>Failed</Th><Th end>Spent</Th><Th end>Average</Th><Th>First / last order</Th><Th>Main zone</Th><Th />
        </>}>
        {data.items.map((c) => (
          <tr key={c.key} onClick={() => setOpenKey(c.key)} className="cursor-pointer hover:bg-gray-50">
            <td className="p-3 font-medium">{c.name || <span className="text-gray-400">–</span>}</td>
            <td className="p-3" dir="ltr">{c.phone}</td>
            <td className="p-3 text-end">{c.orders}</td>
            <td className="p-3 text-end">{c.delivered}</td>
            <td className={`p-3 text-end ${c.failed ? 'font-semibold text-red-700' : ''}`}>{c.failed}</td>
            <td className="p-3 text-end font-semibold">{money(c.spent)}</td>
            <td className="p-3 text-end">{money(c.avg)}</td>
            <td className="p-3 text-xs text-gray-600">{fmtDay(c.first)}<br />{fmtDay(c.last)}</td>
            <td className="p-3">{c.mainZone || '–'}</td>
            <td className="p-3">
              <span className="flex flex-wrap gap-1">
                {c.blocked && <Tag tone="danger">Blocked</Tag>}
                {c.optOut && <Tag tone="muted">Opt-out</Tag>}
                {c.tags.slice(0, 2).map((t) => <Tag key={t} tone="soft">{t}</Tag>)}
              </span>
            </td>
          </tr>
        ))}
      </ListTable>
      <Pager page={page} pages={data.pages} total={data.total} label="customer(s)" onPage={setPage} />

      <AnimatePresence>
        {openKey && <CustomerPanel key={openKey} k={openKey} onClose={close} onChanged={load} />}
      </AnimatePresence>
    </div>
  )
}
