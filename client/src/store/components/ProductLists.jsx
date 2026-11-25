import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { loadCatalog } from '../../lib/catalog'
import { useStore } from '../storeContext'
import ProductTile from './ProductTile'
import Reveal from './Reveal'
import Section from './Section'

const idOf = (v) => String(v?._id || v || '')
const inStockFirst = (list) => [...list.filter((p) => p.stock > 0), ...list.filter((p) => !(p.stock > 0))]

function useOthers(currentId) {
  const [all, setAll] = useState(null)
  useEffect(() => {
    let cancelled = false
    loadCatalog().then((list) => { if (!cancelled) setAll(list) })
    return () => { cancelled = true }
  }, [])
  return all ? all.filter((p) => idOf(p._id) !== idOf(currentId)) : null
}

// "You may also like": a row (5 cards on desktop, about 2.3 on phones), same category first, in stock first
export function AlsoLikeRow({ product }) {
  const { t, lang } = useStore()
  const others = useOthers(product._id)
  const row = useRef(null)
  if (!others || others.length === 0) return null

  const cat = idOf(product.category)
  const list = inStockFirst([
    ...others.filter((p) => cat && idOf(p.category) === cat),
    ...others.filter((p) => !cat || idOf(p.category) !== cat),
  ]).slice(0, 15)

  const scroll = (dir) => {
    const el = row.current
    if (el) el.scrollBy({ left: dir * (lang === 'ar' ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <Section title={t('alsoLike')} action={list.length > 5 && (
      <div className="hidden gap-1 md:flex">
        <button type="button" onClick={() => scroll(-1)} aria-label={t('prev')}
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:bg-quiet">
          <ChevronLeft size={18} className="rtl:rotate-180" />
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label={t('next')}
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:bg-quiet">
          <ChevronRight size={18} className="rtl:rotate-180" />
        </button>
      </div>
    )}>
      <ul ref={row} className="-mx-1.5 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-1.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((p, i) => (
          <Reveal as="li" key={p._id} delay={Math.min(i, 4) * 0.06}
            className="shrink-0 snap-start basis-[calc((100%-1.5rem)/2.3)] md:basis-[calc((100%-2.25rem)/4)] lg:basis-[calc((100%-3rem)/5)]">
            <ProductTile p={p} sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 45vw" />
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}

// "All products": every other active product, in stock first; 6 / 4 / 2 columns; 12 first, then "Show more"
export function AllProductsGrid({ product }) {
  const { t } = useStore()
  const others = useOthers(product._id)
  const [shown, setShown] = useState(12)
  if (!others || others.length === 0) return null
  const list = inStockFirst(others)

  return (
    <Section title={t('allProducts')}>
      <ul className="-mx-1.5 grid grid-cols-2 gap-x-2 gap-y-4 md:grid-cols-4 lg:grid-cols-6">
        {list.slice(0, shown).map((p, i) => (
          <Reveal as="li" key={p._id} delay={(i % 6) * 0.06}><ProductTile p={p} /></Reveal>
        ))}
      </ul>
      {list.length > shown && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + 12)}
            className="min-h-11 rounded-full border-2 border-ink px-6 text-sm font-semibold transition hover:bg-ink hover:text-white">
            {t('showMore')} ({list.length - shown})
          </button>
        </div>
      )}
    </Section>
  )
}
