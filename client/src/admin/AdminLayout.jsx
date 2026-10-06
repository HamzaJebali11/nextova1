import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from './useAuth'

import { LayoutDashboard, ShoppingBag, Package, Tags, Settings as SettingsIcon, LogOut } from 'lucide-react'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
]

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const { pathname } = useLocation()

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white p-4 md:flex">
        <div className="mb-6 px-3 text-xl font-bold tracking-tight">
          Nextova <span className="text-xs font-normal text-gray-400">admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon size={18} /> {label}
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
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
          <span className="font-bold">Nextova</span>
          <nav className="flex items-center gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass} title={label}>
                <Icon size={18} />
              </NavLink>
            ))}
            <button onClick={logout} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
              <LogOut size={18} />
            </button>
          </nav>
        </header>

        <main className="p-4 md:p-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}