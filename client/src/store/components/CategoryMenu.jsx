import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { loadCatalog, productsOf } from '../../lib/catalog'
import { useStore } from '../storeContext'
import { priceText } from '../../lib/options'

// small product row used in the dropdown
function MiniProduct({ p, onGo }) {
  const { t, pick, money } = useStore()
  const out = !(p.stock > 0)
  return (
    <Link to={`/product/${p.slug}`} onClick={onGo}
      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-quiet focus-visible:bg-quiet">
      <img src={optimizeImg(p.images?.[0]?.url, 120)} alt="" width={48} height={48} loading="lazy" decoding="async"
        className={`h-12 w-12 shrink-0 rounded-lg bg-quiet object-cover ${out ? 'opacity-50' : ''}`} />
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{pick(p.name)}</span>
        <span className="text-sm font-semibold">{priceText(p, money, t)}</span>
      </span>
    </Link>
  )
}

// Category row under the header pill (hides and shows with the header).
// Desktop: each entry opens a dropdown with its products (hover, or the arrow button for the keyboard).
// Phones: the row scrolls sideways and each entry opens its category page.
export default function CategoryRow({ hidden }) {
  const { t, pick, categories } = useStore()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(null)
  const [wanted, setWanted] = useState(false) // products load on the first hover / focus only
  const [all, setAll] = useState(null)
  const closeTimer = useRef(0)
  const wrap = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!wanted || all) return
    let cancelled = false
    loadCatalog().then((list) => { if (!cancelled) setAll(list) })
    return () => { cancelled = true }
  }, [wanted, all])

  const top = categories.filter((c) => !c.parent)
  const entries = [
    { key: 'shop', label: t('shop'), to: '/shop', category: null },
    ...top.map((c) => ({ key: c._id, label: pick(c.name), to: `/shop?category=${c.slug}`, category: c })),
  ]

  // close: Esc, outside click
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(null) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  const shown = hidden ? null : open

  const enter = (key) => (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(closeTimer.current)
    setWanted(true)
    setOpen(key)
  }
  const leave = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(null), 160)
  }

  const linkCls = 'inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-transparent px-3 text-sm font-medium text-gray-700 transition hover:bg-white/80 hover:shadow-[0_2px_8px_rgba(17,17,17,0.08)]'

  return (
    <nav ref={wrap} aria-label={t('categories')}
      className="relative z-[var(--z-dropdown)] mt-1.5 flex items-center justify-start gap-1 overflow-x-auto px-1 [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible [&::-webkit-scrollbar]:hidden">
      <NavLink to="/" end className={({ isActive }) => `${linkCls} ${isActive ? 'glass rounded-full text-ink' : ''}`}>{t('home')}</NavLink>
      {entries.map((e, idx) => {
        const isOpen = shown === e.key
        const list = all ? productsOf(all, e.category, categories, 8) : null
        const alignEnd = idx >= entries.length / 2 // later entries open towards the inside of the page
        return (
          <div key={e.key} className="relative shrink-0" onPointerEnter={enter(e.key)} onPointerLeave={leave}>
            <div className="flex items-center">
              <Link to={e.to} onClick={() => setOpen(null)} className={`${linkCls} md:pe-1`}>{e.label}</Link>
              <button type="button" aria-expanded={isOpen} aria-controls={`${panelId}-${e.key}`}
                aria-label={`${e.label}: ${t('showMore')}`}
                onClick={() => { setWanted(true); setOpen(isOpen ? null : e.key) }}
                className="hidden h-11 w-8 place-items-center rounded-full text-gray-600 hover:bg-black/5 md:grid">
                <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <AnimatePresence>
              {isOpen && (
                <motion.div id={`${panelId}-${e.key}`}
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0 : 0.15 }}
                  className={`glass glass-float nx-drop nx-noscrollbar absolute top-full z-[var(--z-dropdown)] mt-2 hidden w-[30rem] overflow-y-auto p-3 md:block ${alignEnd ? 'end-0' : 'start-0'}`}>
                  {!list && <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-quiet" />)}</div>}
                  {list && list.length === 0 && <p className="p-3 text-sm text-gray-500">{t('menuEmpty')}</p>}
                  {list && list.length > 0 && (
                    <div className="grid grid-cols-2 gap-1">
                      {list.map((p) => <MiniProduct key={p._id} p={p} onGo={() => setOpen(null)} />)}
                    </div>
                  )}
                  <Link to={e.to} onClick={() => setOpen(null)}
                    className="glass-btn mt-2 flex w-full rounded-xl px-3 text-center text-sm">
                    {t('viewAll')} · {e.label}
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </nav>
  )
}
