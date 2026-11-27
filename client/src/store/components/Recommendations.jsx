import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { cartLineFor, loadCatalog } from '../../lib/catalog'
import { track } from '../../lib/pixel'
import { useStore } from '../storeContext'
import { priceText } from '../../lib/options'
import { useCart } from '../../cart/cartContext'
import Reveal from './Reveal'

// "You may also like": a quiet, swipeable row of the other active, in-stock products.
// Add puts 1 unit in the cart through the existing cart pricing (no page change, no pop-up).
// Products with options link to their page ("Choose"). Never used inside the "Order now" pop-up.
//   exclude: product ids to leave out; compact: smaller cards (cart quick view); title: text key
export default function Recommendations({ exclude = [], compact = false, title = 'alsoLike', hideTitle = false, className = '' }) {
  const { t, pick, money, lang } = useStore()
  const { addMany } = useCart()
  const [all, setAll] = useState(null)
  const [added, setAdded] = useState(null)
  const row = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadCatalog().then((list) => { if (!cancelled) setAll(list) })
    return () => { cancelled = true }
  }, [])

  const skip = new Set(exclude.map(String))
  const list = (all || []).filter((p) => p.stock > 0 && !skip.has(String(p._id)))
  if (list.length === 0) return null

  function add(p) {
    addMany([cartLineFor(p)])
    track('AddToCart', {
      content_ids: [p._id],
      content_name: p.name?.en || '',
      content_type: 'product',
      value: p.price,
      currency: 'QAR',
    })
    setAdded(p._id)
    setTimeout(() => setAdded((id) => (id === p._id ? null : id)), 1200)
  }

  const scroll = (dir) => {
    const el = row.current
    if (!el) return
    const sign = lang === 'ar' ? -1 : 1
    el.scrollBy({ left: dir * sign * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const card = compact ? 'w-32' : 'w-40'
  return (
    <section className={className} aria-label={t(title)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {hideTitle ? <span /> : <h2 className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{t(title)}</h2>}
        {!compact && list.length > 3 && (
          <div className="hidden gap-1 md:flex">
            <button type="button" onClick={() => scroll(-1)} aria-label={t('prev')}
              className="glass-btn h-11 w-11">
              <ChevronLeft size={16} className="rtl:rotate-180" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label={t('next')}
              className="glass-btn h-11 w-11">
              <ChevronRight size={16} className="rtl:rotate-180" />
            </button>
          </div>
        )}
      </div>
      <ul ref={row} className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((p, idx) => {
          const needsChoice = p.variants?.length > 0
          const done = added === p._id
          return (
            <Reveal as="li" key={p._id} delay={Math.min(idx, 5) * 0.06} className={`${card} glass nx-lift shrink-0 snap-start p-2.5`}>
              <Link to={`/product/${p.slug}`} className="block">
                <img src={optimizeImg(p.images?.[0]?.url, compact ? 200 : 280)} alt="" width={160} height={160}
                  loading="lazy" decoding="async" className="aspect-square w-full rounded-lg bg-quiet object-cover" />
                <span className={`mt-1.5 line-clamp-2 font-medium leading-snug ${compact ? 'text-[11px]' : 'text-xs'}`}>{pick(p.name)}</span>
              </Link>
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className={`font-semibold ${compact ? 'text-[11px]' : 'text-xs'}`}>{priceText(p, money, t)}</span>
                {needsChoice ? (
                  <Link to={`/product/${p.slug}`} className="glass-btn tap-44 min-h-0 px-2 py-1 text-[11px]">
                    {t('choose')}
                  </Link>
                ) : (
                  <button type="button" onClick={() => add(p)} aria-label={`${t('add')} ${pick(p.name)}`}
                    className="glass-btn tap-44 min-h-0 gap-0.5 px-2 py-1 text-[11px]">
                    {done ? <Check size={12} /> : <Plus size={12} />} {done ? t('addedShort') : t('add')}
                  </button>
                )}
              </div>
            </Reveal>
          )
        })}
      </ul>
    </section>
  )
}
