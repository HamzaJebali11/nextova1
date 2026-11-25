import { Suspense, useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Activity, ShoppingBag, Plus, Truck, PhoneCall, Bell, Package, Tags, Star, Megaphone, Eye, FileText,
  Settings as SettingsIcon, LogOut, Radar, Calculator, CalendarClock,
  Users,
  FileBarChart,
  HeartPulse,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from './useAuth'
import OrderToasts from './components/OrderToasts'
import { usePageMeta } from '../lib/seo'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/business', label: 'Business health', icon: Activity },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag, badge: 'orders' },
  { to: '/admin/new-order', label: 'Register an order', icon: Plus },
  { to: '/admin/delivery', label: 'Delivery sheet', icon: Truck },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/leads', label: 'Unfinished orders', icon: PhoneCall, badge: 'leads' },
  { to: '/admin/waitlist', label: 'Waiting list', icon: Bell, badge: 'waitlist' },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/reviews', label: 'Reviews', icon: Star, badge: 'reviews' },
  { to: '/admin/ads', label: 'Ads & costs', icon: Megaphone },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/admin/planner', label: 'Planner', icon: Calculator },
  { to: '/admin/events', label: 'Sales events', icon: CalendarClock },
  { to: '/admin/visitors', label: 'Visitors', icon: Eye },
  { to: '/admin/pixel', label: 'Meta Pixel', icon: Radar },
  { to: '/admin/pages', label: 'Pages', icon: FileText },
  { to: '/admin/system', label: 'System status', icon: HeartPulse },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
]

function Badge({ n, className = '' }) {
  if (!n) return null
  return (
    <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white ${className}`}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  usePageMeta({ robots: 'noindex, nofollow' })
  const { pathname } = useLocation()
  const [counts, setCounts] = useState({})

  const loadCounts = useCallback(() => {
    api('/counts').then(setCounts).catch(() => {})
  }, [])

  // refresh every 30 seconds, when you come back to the tab, and when you change page
  useEffect(() => {
    const id = setInterval(loadCounts, 30000)
    window.addEventListener('focus', loadCounts)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', loadCounts)
    }
  }, [loadCounts])

  useEffect(() => {
    loadCounts()
  }, [pathname, loadCounts])

  const total = ['orders', 'leads', 'reviews', 'waitlist'].reduce((s, k) => s + (counts[k] || 0), 0)

  // new orders not looked at yet: "(n) New order" in the tab title until you look at the admin
  const [unseen, setUnseen] = useState(0)
  const onNewOrders = useCallback((n) => {
    setUnseen((u) => u + n)
    loadCounts() // red circles update straight away
  }, [loadCounts])
  useEffect(() => {
    if (!unseen) return
    const seen = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) setUnseen(0)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'focus']
    // give the toast a moment to be noticed before a mouse move counts as "seen"
    const start = setTimeout(() => events.forEach((e) => window.addEventListener(e, seen)), 1500)
    document.addEventListener('visibilitychange', seen)
    return () => {
      clearTimeout(start)
      events.forEach((e) => window.removeEventListener(e, seen))
      document.removeEventListener('visibilitychange', seen)
    }
  }, [unseen])

  useEffect(() => {
    document.title = unseen
      ? `(${unseen}) New order${unseen > 1 ? 's' : ''} · Nextova admin`
      : total ? `(${total}) Nextova admin` : 'Nextova admin'
    return () => { document.title = 'Nextova' }
  }, [total, unseen])

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 md:flex print:bg-white">
      <OrderToasts onNew={onNewOrders} />
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white p-4 md:flex print:hidden">
        <div className="mb-6 px-3 text-xl font-bold tracking-tight">
          Nextova <span className="text-xs font-normal text-gray-400">admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon size={18} /> {label}
              {badge && <Badge n={counts[badge]} className="ms-auto" />}
            </NavLink>
          ))}
        </nav>
        <div className="border-t pt-3 text-sm">
          <div className="truncate px-3 text-gray-500">{admin?.email}</div>
          <button onClick={logout}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-2 border-b bg-white px-4 py-3 md:hidden print:hidden">
          <span className="font-bold">Nextova</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink key={to} to={to} end={end} title={label}
                className={(state) => `${linkClass(state)} relative`}>
                <Icon size={18} />
                {badge && <Badge n={counts[badge]} className="absolute -end-1 -top-1" />}
              </NavLink>
            ))}
            <button onClick={logout} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
              <LogOut size={18} />
            </button>
          </nav>
        </header>

        <main className="p-4 md:p-8 print:p-0">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}>
            <Suspense fallback={<div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-gray-200" /><div className="h-64 rounded-2xl bg-gray-200" /></div>}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
    </div>
  )
}