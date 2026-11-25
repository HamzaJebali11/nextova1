import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import BestSellerChip from './BestSellerChip'
import { Stars } from './Stars'

// Arabic / Latin folding used only to find the part to show in bold (the server does the real matching)
const fold = (ch) => ch.normalize('NFD').replace(/[̀-ًͯ-ٰٟ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase()
function Highlight({ text, q }) {
  const needle = q.trim().split(/\s+/).sort((a, b) => b.length - a.length)[0] || ''
  if (needle.length < 2) return text
  const chars = [...text]
  const folded = chars.map(fold)
  const target = [...needle].map(fold).join('')
  for (let i = 0; i < chars.length; i++) {
    let j = i
    let k = 0
    while (j < chars.length && k < target.length) {
      const f = folded[j]
      if (f === '') { j++; continue }
      if (target.startsWith(f, k)) { k += f.length; j++ } else break
    }
    if (k >= target.length) {
      return <>{chars.slice(0, i).join('')}<b className="font-bold">{chars.slice(i, j).join('')}</b>{chars.slice(j).join('')}</>
    }
  }
  return text
}

export default function SearchBox({ autoFocus = false }) {
  const { t, pick, money } = useStore()
  const navigate = useNavigate()
  const id = useId()
  const [q, setQ] = useState('')
  const [res, setRes] = useState({ q: '', items: [], popular: [] })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      api(`/products/search?q=${encodeURIComponent(term)}&limit=6`)
        .then((d) => { if (!cancelled) { setRes({ q: term, items: d.items || [], popular: d.popular || [] }); setActive(-1) } })
        .catch(() => {})
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q])

  const ready = q.trim().length >= 2 && res.q === q.trim()
  const none = ready && res.items.length === 0
  const list = none ? res.popular : res.items
  const show = open && ready && (list.length > 0 || none)

  function go(p) {
    setOpen(false)
    navigate(`/product/${p.slug}`)
  }
  function submit(e) {
    e.preventDefault()
    if (show && active >= 0 && list[active]) return go(list[active])
    if (!q.trim()) return
    setOpen(false)
    navigate(`/shop?q=${encodeURIComponent(q.trim())}`)
  }
  function onKey(e) {
    if (!show) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(list.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div className="relative">
      <form onSubmit={submit} className="relative" role="search">
        <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onKeyDown={onKey}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} autoFocus={autoFocus}
          type="search" enterKeyHint="search" role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={show && active >= 0 ? `${id}-${active}` : undefined}
          className="min-h-10 w-full rounded-full border border-line bg-white py-2 pe-4 ps-10 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-black/10" />
      </form>

      <AnimatePresence>
        {show && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-white shadow-e3">
            {none && (
              <div className="border-b px-3 py-2.5 text-sm">
                <div className="font-semibold">{t('noResultsFor').replace('{q}', q.trim())}</div>
                {list.length > 0 && <div className="text-xs text-gray-500">{t('popularNow')}</div>}
              </div>
            )}
            <ul id={`${id}-list`} role="listbox" aria-label={t('searchPlaceholder')}>
              {list.map((p, i) => (
                <li key={p._id} id={`${id}-${i}`} role="option" aria-selected={active === i}>
                  <Link to={`/product/${p.slug}`} onClick={() => setOpen(false)} onMouseEnter={() => setActive(i)}
                    className={`flex min-h-12 items-center gap-3 p-2 ${active === i ? 'bg-quiet' : 'hover:bg-quiet'}`}>
                    <img src={optimizeImg(p.image, 100)} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-quiet object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{none ? pick(p.name) : <Highlight text={pick(p.name)} q={q} />}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {p.ratingCount > 0 && <span className="flex items-center gap-1 text-[11px] text-ink"><Stars value={p.ratingAvg} size={11} /><span className="tabular-nums">({p.ratingCount})</span></span>}
                        {p.isBestSeller && <BestSellerChip small />}
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm ${p.inStock ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{money(p.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!none && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); navigate(`/shop?q=${encodeURIComponent(q.trim())}`) }}
                className="block w-full border-t px-3 py-2.5 text-start text-sm font-semibold hover:bg-quiet">{t('seeAllResults')}</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
