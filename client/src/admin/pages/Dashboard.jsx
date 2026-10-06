import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Wallet, Clock, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'
import { money, fmtDate } from '../../lib/constants'
import StatusBadge from '../components/StatusBadge'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

function Card({ icon: Icon, label, value, tone }) {
  return (
    <motion.div variants={item} className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </motion.div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [low, setLow] = useState([])
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api('/orders/stats').then(setStats).catch(() => {})
    api('/products/admin/all?lowStock=true&limit=8').then((d) => setLow(d.items)).catch(() => {})
    api('/orders?limit=5').then((d) => setRecent(d.items)).catch(() => {})
  }, [])

  const find = (s) => stats?.byStatus.find((x) => x._id === s)
  const newCount = find('new')?.count || 0
  const deliveredRevenue = find('delivered')?.revenue || 0

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <motion.div variants={container} initial="hidden" animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card icon={ClipboardList} label="Orders today" value={stats?.today.orders ?? '–'} tone="bg-blue-100 text-blue-700" />
        <Card icon={Wallet} label="Sales today" value={stats ? money(stats.today.revenue) : '–'} tone="bg-green-100 text-green-700" />
        <Card icon={Clock} label="New orders to handle" value={stats ? newCount : '–'} tone="bg-amber-100 text-amber-700" />
        <Card icon={Wallet} label="Delivered revenue" value={stats ? money(deliveredRevenue) : '–'} tone="bg-purple-100 text-purple-700" />
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Recent orders</h2>
          {recent.length === 0 && <p className="text-sm text-gray-500">No orders yet.</p>}
          <ul className="divide-y">
            {recent.map((o) => (
              <li key={o._id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{o.orderNumber} · {o.customer.name}</div>
                  <div className="text-xs text-gray-500">{fmtDate(o.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{money(o.total)}</div>
                  <StatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <AlertTriangle size={18} className="text-amber-500" /> Low stock
          </h2>
          {low.length === 0 && <p className="text-sm text-gray-500">All products are well stocked.</p>}
          <ul className="divide-y">
            {low.map((p) => (
              <li key={p._id} className="flex items-center justify-between py-3">
                <span className="font-medium">{p.name.en}</span>
                <span className={`text-sm font-semibold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {p.stock} left
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}