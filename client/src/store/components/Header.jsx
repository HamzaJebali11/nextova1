import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Languages, Menu, ShoppingBag, X } from 'lucide-react'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import SearchBox from './SearchBox'
import Logo from './Logo'

export default function Header() {
  const { t, pick, categories, toggleLang } = useStore()
  const { count, setOpen } = useCart()
  const [menu, setMenu] = useState(false)
  const top = categories.filter((c) => !c.parent)

  const navCls = ({ isActive }) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-emerald-50 hover:text-emerald-700 ${
      isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
    }`

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="mx-auto max-w-7xl rounded-3xl border border-white/60 bg-white/70 shadow-lg shadow-black/5 backdrop-blur-xl lg:rounded-full">
        <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
          <button className="rounded-lg p-1 lg:hidden" onClick={() => setMenu(!menu)} aria-label={t('menu')}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" aria-label="Home"><Logo /></Link>

          <nav className="ms-4 hidden items-center gap-1 lg:flex">
            <NavLink to="/" end className={navCls}>{t('home')}</NavLink>
            <NavLink to="/shop" className={navCls}>{t('shop')}</NavLink>
            {top.slice(0, 4).map((c) => (
              <Link key={c._id} to={`/shop?category=${c.slug}`}
                className="rounded-full px-3 py-1.5 text-sm text-gray-600 transition hover:bg-emerald-50 hover:text-emerald-700">
                {pick(c.name)}
              </Link>
            ))}
          </nav>

          <div className="hidden w-full max-w-sm lg:ms-auto lg:block"><SearchBox /></div>

          <div className="ms-auto flex items-center gap-1 lg:ms-0">
            <button onClick={toggleLang}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium hover:bg-black/5">
              <Languages size={18} /> {t('langToggle')}
            </button>
            <button onClick={() => setOpen(true)} aria-label={t('cart')}
              className="relative rounded-full p-2 hover:bg-black/5">
              <ShoppingBag size={22} />
              {count > 0 && (
                <motion.span key={count} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                  className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold text-white">
                  {count}
                </motion.span>
              )}
            </button>
          </div>
        </div>

        <div className="px-4 pb-3 lg:hidden"><SearchBox /></div>

        <AnimatePresence>
          {menu && (
            <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden rounded-b-3xl border-t border-black/5 lg:hidden">
              <div className="flex flex-col gap-1 p-4">
                <Link onClick={() => setMenu(false)} to="/" className="rounded-xl px-3 py-2 font-medium hover:bg-black/5">{t('home')}</Link>
                <Link onClick={() => setMenu(false)} to="/shop" className="rounded-xl px-3 py-2 font-medium hover:bg-black/5">{t('shop')}</Link>
                {top.map((c) => (
                  <Link key={c._id} onClick={() => setMenu(false)} to={`/shop?category=${c.slug}`}
                    className="rounded-xl px-3 py-2 text-gray-600 hover:bg-black/5">
                    {pick(c.name)}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}