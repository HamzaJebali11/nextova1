import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/constants'
import { ListTable, PageHeader, Tag, Th } from '../components/ListKit'
import { btn } from '../components/listStyles'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const ago = (d) => {
  if (!d) return 'never'
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m} min ago`
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} days ago`
}

export default function SystemStatus() {
  const [s, setS] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const load = useCallback(() => {
    api('/system/status').then((x) => { setS(x); setError('') }).catch((e) => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  async function clearAll() {
    if (!confirm('Delete every saved error?')) return
    await api('/system/errors', { method: 'DELETE' }).catch((e) => alert(e.message))
    load()
  }

  const errors = (s?.errors || []).filter((e) => !filter || e.source === filter)
  return (
    <div>
      <PageHeader title="System status" subtitle="Database, last order and the errors of the last 30 days (no customer data is stored)."
        actions={<button onClick={load} className={btn.ghost}><RefreshCw size={15} /> Refresh</button>} />
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Database</div>
            <div className="text-xl font-extrabold">{s.db.ok ? 'Up' : 'DOWN'}</div>
            <div className="text-xs text-gray-500">{s.db.ms} ms</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Last order</div>
            <div className="text-xl font-extrabold">{s.lastOrder ? ago(s.lastOrder.at) : '–'}</div>
            <div className="text-xs text-gray-500">{s.lastOrder ? `${s.lastOrder.orderNumber} · ${s.lastOrder.source}` : 'none yet'}{s.lastWebsiteOrderAt ? ` · website: ${ago(s.lastWebsiteOrderAt)}` : ''}</div>
          </div>
          <div className={`rounded-2xl border bg-white p-4 shadow-sm ${s.errors24h.total > 0 ? 'ring-1 ring-red-300' : ''}`}>
            <div className="text-xs text-gray-500">Errors, last 24 hours</div>
            <div className="text-xl font-extrabold">{s.errors24h.total}</div>
            <div className="text-xs text-gray-500">server {s.errors24h.server} · browser {s.errors24h.client}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Server</div>
            <div className="text-xl font-extrabold">{Math.round(s.server.uptimeSec / 3600)} h up</div>
            <div className="text-xs text-gray-500">Node {s.server.node}</div>
          </div>
        </div>
      )}
      <section className="mb-5 rounded-2xl border bg-gray-50 p-4 text-sm">
        <b>Uptime check address</b> (for UptimeRobot or similar): <code className="break-all rounded bg-white px-1.5 py-0.5" dir="ltr">{API ? `${API}/health` : '/health on your API'}</code>
        <span className="text-gray-600"> · answers 200 when everything works, 503 when the database is down.</span>
      </section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[['', 'All'], ['server', 'Server'], ['client', 'Browser']].map(([v, l]) => (
          <button key={v || 'all'} onClick={() => setFilter(v)} className={`rounded-full px-3.5 py-1.5 text-sm ${filter === v ? 'bg-ink text-white' : 'border bg-white hover:bg-gray-100'}`}>{l}</button>
        ))}
        {(s?.errors || []).length > 0 && <button onClick={clearAll} className="ms-auto text-sm underline">Clear the list</button>}
      </div>
      <ListTable loading={!s && !error} empty={s && errors.length === 0 ? 'No errors. 🎉' : null} colSpan={5} minWidth="48rem"
        head={<><Th>Last seen</Th><Th>Where</Th><Th>Message</Th><Th end>Times</Th><Th>Source</Th></>}>
        {errors.map((e) => (
          <tr key={e._id} className="align-top">
            <td className="whitespace-nowrap p-3 text-xs text-gray-600">{fmtDate(e.lastAt)}</td>
            <td className="max-w-[14rem] break-all p-3 font-mono text-xs">{e.route || '–'}</td>
            <td className="p-3">{e.message}</td>
            <td className="p-3 text-end">{e.count}</td>
            <td className="p-3"><Tag tone={e.source === 'server' ? 'ink' : 'soft'}>{e.source === 'server' ? 'Server' : 'Browser'}</Tag></td>
          </tr>
        ))}
      </ListTable>
    </div>
  )
}
