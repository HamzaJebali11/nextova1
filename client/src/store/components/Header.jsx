import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Languages, Search, X } from 'lucide-react'
import { useStore } from '../storeContext'
import SearchBox from './SearchBox'
import Logo from './Logo'
import EventBanner from './EventBanner'
import CartQuickView from './CartQuickView'
import CategoryRow from './CategoryMenu'

// Header: the rounded see-through pill (no blur) with logo, wide search (desktop) or a search icon that
// opens a full-width bar (phones), language switch and the cart with its quick view; under it the category
// row and the sales banner. Everything hides on scroll down and shows on scroll up.
export default function Header() {
  const { t, lang, toggleLang } = useStore()
  const { pathname } = useLocation()
  const [searchFor, setSearchFor] = useState(null) // page where the phone search was opened
  const searchOpen = searchFor === pathname

  // Hide on scroll down, show on scroll up; always shown near the top
  const [hidden, setHidden] = useState(false)
  const [atTop, setAtTop] = useState(() => window.scrollY < 8)
  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        const delta = y - lastY
        setAtTop(y < 8)
        if (y < 80) setHidden(false)
        else if (delta > 8) setHidden(true)
        else if (delta < -8) setHidden(false)
        if (Math.abs(delta) > 8 || y < 80) lastY = y
      })
    }
    const show = () => setHidden(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('nx:show-header', show)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('nx:show-header', show)
      cancelAnimationFrame(frame)
    }
  }, [])
  const isHidden = hidden && !searchOpen

  // where the pill ends on screen: the panels that drop from the header use it for their maximum height
  const pill = useRef(null)
  useEffect(() => {
    const el = pill.current
    if (!el) return
    const put = () => document.documentElement.style.setProperty('--header-h', `${Math.round(el.getBoundingClientRect().bottom)}px`)
    put()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(put) : null
    ro?.observe(el)
    window.addEventListener('resize', put)
    return () => { ro?.disconnect(); window.removeEventListener('resize', put) }
  }, [])

  return (
    <header
      data-hidden={isHidden ? 'true' : undefined}
      className={`nx-page sticky top-0 z-[var(--z-header)] pb-1.5 pt-2 transition-transform duration-300 ease-out motion-reduce:transition-none md:pt-3 ${
        isHidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0'
      }`}
    >
      {/* the pill is its own layer (its glass blur makes it a stacking context): above the category row and the sales banner */}
      <div ref={pill} className={`relative z-[calc(var(--z-dropdown)+1)] border transition-[background-color,border-color,box-shadow,border-radius] duration-300 motion-reduce:transition-none ${
        searchOpen ? 'rounded-[28px] md:rounded-full' : 'rounded-full'
      } ${
        searchOpen
          ? 'glass glass-float'
          : atTop
            ? 'border-transparent bg-transparent'
            : 'glass glass-float'
      }`}>
        <div className="flex items-center gap-2 px-3 py-2 md:gap-4 md:px-5 md:py-2.5">
          <Link to="/" aria-label={t('home')} className="flex min-h-11 shrink-0 items-center"><Logo /></Link>

          {/* wide search (desktop) */}
          <div className="hidden min-w-0 flex-1 md:block"><SearchBox /></div>

          <div className="ms-auto flex shrink-0 items-center gap-0.5 md:ms-0">
            {/* phones: search icon opens a full-width bar */}
            <button type="button" onClick={() => setSearchFor(searchOpen ? null : pathname)}
              aria-label={t('searchPlaceholder')} aria-expanded={searchOpen}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-black/5 md:hidden">
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
            <button type="button" onClick={toggleLang} aria-label={t('langToggle')}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 text-sm font-medium hover:bg-black/5">
              <Languages size={18} aria-hidden="true" /> <span className="hidden sm:inline">{t('langToggle')}</span>
              <span className="sm:hidden" aria-hidden="true">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
            <CartQuickView headerHidden={isHidden} />
          </div>
        </div>

        {searchOpen && <div className="px-3 pb-3 md:hidden"><SearchBox autoFocus /></div>}
      </div>

      {/* categories (desktop hover dropdowns; phones scroll sideways) */}
      <CategoryRow hidden={isHidden} />
      <EventBanner />
    </header>
  )
}
