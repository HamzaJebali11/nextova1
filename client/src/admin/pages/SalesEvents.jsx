import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'
import { eventCountdown } from '../../lib/eventTime'
import { FilterChip, ListTable, PageHeader, SidePanel, Tag, Th, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'

const inputCls = 'w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'
const blank = { name: { en: '', ar: '' }, startDate: '', endDate: '', minPct: 0, maxPct: '', active: true }

function StatusTag({ e }) {
  if (e.status === 'off') return <Tag tone="muted">Off</Tag>
  if (e.status === 'upcoming') return <Tag tone="soft">Upcoming</Tag>
  if (e.status === 'ended') return <Tag tone="muted">Ended</Tag>
  const cd = eventCountdown(e.endsAt)
  const left = !cd ? 'ending' : cd.kind === 'clock' ? `ends in ${cd.text}` : cd.kind === 'tomorrow' ? 'ends tomorrow' : cd.kind === 'today' ? 'ends today' : `${cd.n} days left`
  return <Tag tone="ink">Live · {left}</Tag>
}

export default function SalesEvents() {
  const [list, setList] = useState(null)
  const [show, setShow] = useState('all')
  const [editing, setEditing] = useState(null) // null | 'new' | id
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api('/events').then(setList).catch(() => setList([])), [])
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function open(e) {
    setError('')
    setEditing(e ? e._id : 'new')
    setF(e ? { name: { en: e.name?.en || '', ar: e.name?.ar || '' }, startDate: e.startDate, endDate: e.endDate, minPct: e.minPct || 0, maxPct: e.maxPct, active: e.active } : blank)
  }

  async function save(ev) {
    ev.preventDefault()
    setError('')
    setBusy(true)
    const body = { ...f, minPct: Number(f.minPct) || 0, maxPct: Number(f.maxPct) }
    try {
      if (editing === 'new') await api('/events', { method: 'POST', body })
      else await api(`/events/${editing}`, { method: 'PUT', body })
      setEditing(null)
      load()
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' · ') || err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(e) {
    try {
      await api(`/events/${e._id}`, { method: 'PUT', body: { active: !e.active } })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  async function remove(e) {
    if (!confirm(`Delete "${e.name?.en}"? Orders keep their event label.`)) return
    try {
      await api(`/events/${e._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const all = list || []
  const count = (s) => all.filter((e) => e.status === s).length
  const rows = all.filter((e) => show === 'all' || e.status === show)
  const preview = f.minPct > 0 ? `${f.minPct}% to ${f.maxPct || 'Y'}% off` : `Up to ${f.maxPct || 'Y'}% off`

  return (
    <div>
      <PageHeader
        title="Sales events"
        subtitle="A banner shown to visitors (for example Black Friday). DISPLAY ONLY: it never changes any price, pack price, cart, order total, profit or report. The % range is text you type. Dates are Qatar time: from 00:00 on the start date to 23:59:59 on the end date."
        actions={<button onClick={() => open(null)} className={btn.dark}><Plus size={15} /> New event</button>}
      />

      <Toolbar>
        <FilterChip active={show === 'all'} onClick={() => setShow('all')} count={all.length}>All</FilterChip>
        <FilterChip active={show === 'live'} onClick={() => setShow('live')} count={count('live')} alert>Live</FilterChip>
        <FilterChip active={show === 'upcoming'} onClick={() => setShow('upcoming')} count={count('upcoming')}>Upcoming</FilterChip>
        <FilterChip active={show === 'ended'} onClick={() => setShow('ended')} count={count('ended')}>Ended</FilterChip>
        <FilterChip active={show === 'off'} onClick={() => setShow('off')} count={count('off')}>Off</FilterChip>
      </Toolbar>

      <ListTable colSpan={7} loading={!list} empty={rows.length === 0 && 'No events yet.'} minWidth="56rem"
        head={<><Th>Event</Th><Th>Dates (Qatar)</Th><Th>Shown as</Th><Th>Status</Th><Th end>Orders</Th><Th end>Revenue</Th><Th end>Actions</Th></>}>
        {rows.map((e) => (
          <tr key={e._id} onClick={() => open(e)} className="cursor-pointer align-top hover:bg-gray-50">
            <td className="p-3">
              <div className="font-semibold">{e.name?.en}</div>
              {e.name?.ar && <div className="text-xs text-gray-500" dir="rtl">{e.name.ar}</div>}
            </td>
            <td className="p-3 text-gray-700">{e.startDate} → {e.endDate}</td>
            <td className="p-3"><Tag tone="soft">{e.minPct > 0 ? `${e.minPct}% to ${e.maxPct}% off` : `Up to ${e.maxPct}% off`}</Tag></td>
            <td className="p-3"><StatusTag e={e} /></td>
            <td className="p-3 text-end">
              {e.orders > 0 ? <Link to={`/admin/orders?event=${e._id}`} onClick={(x) => x.stopPropagation()} className="font-semibold underline">{e.orders}</Link> : 0}
            </td>
            <td className="p-3 text-end font-semibold">{money(e.revenue)}</td>
            <td className="p-3" onClick={(x) => x.stopPropagation()}>
              <div className="flex items-center justify-end gap-2">
                <button type="button" role="switch" aria-checked={e.active} aria-label={`${e.name?.en} on or off`} onClick={() => toggle(e)}
                  className={`relative h-6 w-11 rounded-full transition ${e.active ? 'bg-ink' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${e.active ? 'start-[1.375rem]' : 'start-0.5'}`} />
                </button>
                <button onClick={() => open(e)} className={btn.ghost} aria-label={`Edit ${e.name?.en}`}><Pencil size={14} /></button>
                <button onClick={() => remove(e)} className={btn.danger} aria-label={`Delete ${e.name?.en}`}><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </ListTable>
      <p className="mt-2 text-xs text-gray-500">Orders and revenue: orders placed while the event was live (revenue leaves out cancelled and returned orders).</p>

      <AnimatePresence>
        {editing && (
          <SidePanel key={editing} title={editing === 'new' ? 'New sales event' : 'Edit sales event'} onClose={() => setEditing(null)}>
            <form onSubmit={save} className="space-y-4">
              {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-sm font-medium">Name (English) *</span>
                  <input required maxLength={60} className={inputCls} placeholder="Black Friday" value={f.name.en}
                    onChange={(e) => setF({ ...f, name: { ...f.name, en: e.target.value } })} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">Name (Arabic)</span>
                  <input dir="rtl" maxLength={60} className={inputCls} placeholder="الجمعة البيضاء" value={f.name.ar}
                    onChange={(e) => setF({ ...f, name: { ...f.name, ar: e.target.value } })} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">Start date * (from 00:00)</span>
                  <input required type="date" className={inputCls} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">End date * (until 23:59:59)</span>
                  <input required type="date" min={f.startDate || undefined} className={inputCls} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">From % (0 = “Up to”)</span>
                  <input type="number" min="0" max="99" className={inputCls} value={f.minPct} onChange={(e) => setF({ ...f, minPct: e.target.value })} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">To % *</span>
                  <input required type="number" min="1" max="99" className={inputCls} value={f.maxPct} onChange={(e) => setF({ ...f, maxPct: e.target.value })} /></label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active (shown while its dates are live)
              </label>
              <div className="rounded-xl bg-gray-100 p-3 text-sm">
                <div className="mb-1 text-xs text-gray-500">Banner preview</div>
                <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-[12px] text-white">
                  <b>{f.name.en || 'Event name'}</b>
                  <span className="rounded-full bg-accent px-2 font-bold text-white">{preview}</span>
                  <span>5 days left</span>
                </span>
                <p className="mt-2 text-xs text-gray-600">Text only. Product prices stay exactly as you set them on each product.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className={btn.ghost}>Cancel</button>
                <button disabled={busy} className={btn.save}>{busy ? 'Saving…' : 'Save event'}</button>
              </div>
            </form>
          </SidePanel>
        )}
      </AnimatePresence>
    </div>
  )
}
