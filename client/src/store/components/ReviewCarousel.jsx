import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Quote, ShieldCheck } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { Stars } from './Stars'
import Lightbox from './Lightbox'

const GAP = 16
const stepOf = (el) => {
  const card = el.querySelector('[data-card]')
  return card ? card.getBoundingClientRect().width + GAP : el.clientWidth
}
const direction = () => (document.documentElement.dir === 'rtl' ? -1 : 1)
const slide = (el, dir) => el.scrollBy({ left: dir * direction() * stepOf(el), behavior: 'smooth' })

export default function ReviewCarousel({ items, showProduct = false }) {
  const { t, lang, pick } = useStore()
  const ref = useRef(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    if (paused || items.length < 2) return
    const id = setInterval(() => {
      const el = ref.current
      if (!el) return
      const atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 8
      if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' })
      else slide(el, 1)
    }, 5500)
    return () => clearInterval(id)
  }, [paused, items.length])

  function onScroll() {
    const el = ref.current
    if (el) setActive(Math.round(Math.abs(el.scrollLeft) / stepOf(el)))
  }

  const fmt = (d) =>
    new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-QA-u-nu-latn' : 'en-GB', { dateStyle: 'medium' })

  const arrow = 'grid h-10 w-10 place-items-center rounded-full border bg-white transition hover:bg-gray-900 hover:text-white'

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="me-2 text-sm text-gray-500">{Math.min(active + 1, items.length)} / {items.length}</span>
        <button onClick={() => ref.current && slide(ref.current, -1)} aria-label={t('prev')} className={arrow}>
          <ChevronLeft size={20} className="rtl:rotate-180" />
        </button>
        <button onClick={() => ref.current && slide(ref.current, 1)} aria-label={t('next')} className={arrow}>
          <ChevronRight size={20} className="rtl:rotate-180" />
        </button>
      </div>

      <div ref={ref} onScroll={onScroll}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((r) => (
          <article data-card key={r._id}
            className="flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border bg-white sm:w-[calc(50%_-_0.5rem)] lg:w-[calc(33.333%_-_0.67rem)]">
            {r.images?.[0] && (
              <button onClick={() => setZoom(r.images[0].url)} className="block">
                <img src={optimizeImg(r.images[0].url, 600)} alt="" className="aspect-[4/3] w-full object-cover transition hover:opacity-90" />
              </button>
            )}
            <div className="flex flex-1 flex-col p-5">
              {!r.images?.[0] && <Quote size={32} className="mb-2 text-emerald-200" />}
              <div className="flex items-center justify-between">
                <Stars value={r.rating} size={16} />
                <span className="text-xs text-gray-400">{fmt(r.createdAt)}</span>
              </div>
              {r.title && <h3 className="mt-2 font-semibold">{r.title}</h3>}
              {r.comment && <p className="mt-1 line-clamp-5 whitespace-pre-line text-sm text-gray-600">{r.comment}</p>}

              <div className="mt-auto flex items-center gap-3 pt-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  {r.name?.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium">{r.name}</div>
                  {r.verified && (
                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <ShieldCheck size={13} /> {t('verifiedBuyer')}
                    </div>
                  )}
                  {showProduct && r.product?.slug && (
                    <Link to={`/product/${r.product.slug}`} className="block truncate text-xs text-emerald-600 hover:underline">
                      {pick(r.product.name)}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <AnimatePresence>{zoom && <Lightbox url={zoom} onClose={() => setZoom(null)} />}</AnimatePresence>
    </div>
  )
}