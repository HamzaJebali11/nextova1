import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Banknote } from 'lucide-react'
import { fetchOnce } from '../../lib/prefetch'
import { imgSrcSet, optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { Stars } from './Stars'

// Home page first screen "H1" (Step 39): one hero product card with price and Order now, changing by itself.
// - Products come from GET /products/hero (server: visible + in stock only; auto or chosen in Settings).
//   Display only: prices are the product's own; the card just opens the product page.
// - Every N seconds (Settings, default 3) the WHOLE card and the rating row change together: a 400 ms
//   opacity crossfade, nothing moves, every slide sits in the same fixed box (no layout shift).
// - Never pauses on mouse hover. Pauses while the tab is hidden and while a finger/pointer is down on the card.
//   With "reduce motion" it keeps running (it is only a fade anyway).
// - Dots (and swipe on phones, arrow keys when the card has focus) pick a product and restart the count.
// - One timer at most: it is set again only when the shown product, the count, the speed or the pause
//   state change, never by an unrelated re-render; cleared on unmount.
// the card picture's width on screen (index.html preloads the first picture with the same srcset + sizes)
const HERO_SIZES = '(min-width: 1180px) 540px, (min-width: 1024px) 45vw, calc(100vw - 66px)'
const FADE = 'transition-opacity duration-[400ms] ease-out'

export default function HeroH1() {
  const { t, pick, money, lang } = useStore()
  const [data, setData] = useState(null) // { seconds, items } once loaded
  const [active, setActive] = useState(0)
  const [epoch, setEpoch] = useState(0) // bumped by a dot / swipe / key: the count starts again
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const [touching, setTouching] = useState(false)
  const start = useRef(null)
  const swiped = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchOnce('/products/hero')
      .then((d) => { if (!cancelled) setData(d && Array.isArray(d.items) ? d : { seconds: 3, items: [] }) })
      .catch(() => { if (!cancelled) setData({ seconds: 3, items: [] }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const items = data?.items || []
  const n = items.length
  const cur = n ? active % n : 0
  const ms = Math.min(10, Math.max(2, Number(data?.seconds) || 3)) * 1000

  useEffect(() => {
    if (n < 2 || hidden || touching) return
    const id = setTimeout(() => setActive((a) => (a + 1) % n), ms)
    return () => clearTimeout(id)
  }, [cur, n, ms, hidden, touching, epoch])

  const go = (i) => { setActive(((i % n) + n) % n); setEpoch((e) => e + 1) }
  const rtl = lang === 'ar'

  // swipe (touch and pen; a mouse click stays a click)
  const onPointerDown = (e) => {
    setTouching(true)
    start.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY }
    swiped.current = false
  }
  const onPointerUp = (e) => {
    setTouching(false)
    const s = start.current
    start.current = null
    if (!s || n < 2) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    swiped.current = true // the click that follows a swipe does not open the product
    go(cur + ((dx < 0) !== rtl ? 1 : -1))
  }
  const onPointerCancel = () => { setTouching(false); start.current = null }
  const onKeyDown = (e) => {
    if (n < 2 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
    e.preventDefault()
    go(cur + ((e.key === 'ArrowRight') !== rtl ? 1 : -1))
  }

  const priceOf = (p) => (p.from ? t('fromPrice').replace('{amt}', money(p.price)) : money(p.price))
  const loading = data === null

  return (
    <section aria-label={t('heroProducts')} className="nx-page pt-2.5">
      <div className="glass glass-sheen nx-hero grid gap-4 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:items-center lg:gap-12">
        {/* left: the message */}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,106,26,0.14)] px-3.5 py-1.5 text-sm font-semibold text-[#B33A0B]">
            <Banknote size={16} aria-hidden="true" /> {t('heroBadge')}
          </span>
          <h1 className="nx-hero-title mt-3 line-clamp-2 lg:mt-5">{t('heroH1Title')}</h1>
          <p className="mt-2 text-sm leading-snug text-gray-600 lg:hidden">{t('heroH1SubShort')}</p>
          <p className="mt-4 hidden max-w-xl text-lg leading-relaxed text-gray-600 lg:block">{t('heroH1Sub')}</p>
          <div className="mt-8 hidden flex-wrap items-center gap-6 lg:flex">
            <Link to="/shop?sort=popular"
              className="btn-primary-glass h-12 px-7">
              {t('heroShopBest')} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden="true" />
            </Link>
            <a href="#categories" className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 hover:decoration-2">
              {t('heroSecondary')}
            </a>
          </div>
          {/* rating of the product shown on the card (real approved reviews only); height kept, no jump */}
          <div className="relative mt-3 h-6 lg:mt-6" aria-live="off">
            {items.map((p, i) => (
              <div key={p.id} aria-hidden={i !== cur} className={`absolute inset-0 flex items-center gap-2 text-sm ${FADE} ${i === cur ? 'opacity-100' : 'opacity-0'}`}>
                {p.ratingCount > 0 && (
                  <>
                    <Stars value={p.ratingAvg} size={16} />
                    <span className="font-medium text-ink">
                      {t(p.ratingCount === 1 ? 'heroRatingOne' : 'heroRating')
                        .replace('{avg}', (Math.round(p.ratingAvg * 10) / 10).toFixed(1)).replace('{n}', p.ratingCount)}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* right: the product card (fixed box: every product fits the same size); grows with the screen up to 760px */}
        <div className="min-w-0 lg:mx-auto lg:w-full lg:max-w-[760px]">
          {(loading || n > 0) && (
            <div role="group" aria-roledescription="carousel" aria-label={t('heroProducts')} tabIndex={n > 1 ? 0 : undefined}
              onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
              onPointerLeave={onPointerCancel} onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); swiped.current = false } }}
              className="nx-hero-card relative aspect-[4/3] w-full lg:aspect-[5/4] touch-pan-y select-none overflow-hidden rounded-[20px] bg-quiet outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              {loading && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-quiet" />}
              {items.map((p, i) => {
                const on = i === cur
                return (
                  <Link key={p.id} to={`/product/${p.slug}`} draggable={false} aria-hidden={!on} tabIndex={on ? undefined : -1} inert={!on}
                    className={`absolute inset-0 block ${FADE} ${on ? 'z-[var(--z-content)] opacity-100' : 'pointer-events-none opacity-0'}`}>
                    {p.image && (
                      <img src={optimizeImg(p.image, 720)} srcSet={imgSrcSet(p.image)} sizes={HERO_SIZES} width={720} height={576}
                        alt={pick(p.name)} draggable={false} decoding="async"
                        loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'low'}
                        className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    {p.bestSeller && (
                      <span className="absolute start-3 top-3 rounded-full bg-[#111111] px-2.5 py-1 text-xs font-semibold text-white">{t('bestSeller')}</span>
                    )}
                    {p.savePct > 0 && (
                      <span className="absolute end-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">{t('heroSave').replace('{n}', p.savePct)}</span>
                    )}
                    <div className="glass glass-on-photo absolute inset-x-3 bottom-3 flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{pick(p.name)}</div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 whitespace-nowrap text-sm">
                          <span className="font-bold text-ink">{priceOf(p)}</span>
                          {p.oldPrice && <span className="text-xs text-gray-500 line-through">{money(p.oldPrice)}</span>}
                          <span className="text-xs font-semibold text-accent">{t('inStockLabel')}</span>
                        </div>
                      </div>
                      <span className="btn-primary-glass h-11 min-h-11 shrink-0 px-4 text-sm">{t('orderShort')}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <Link to="/shop?sort=popular"
            className="btn-primary-glass mt-3 flex h-12 w-full px-6 lg:hidden">
            {t('heroShopBest')} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden="true" />
          </Link>

          {/* dots (height kept even with one product, so nothing below moves) */}
          <div className="flex h-11 justify-center lg:mt-2">
            {n > 1 && items.map((p, i) => (
              <button key={p.id} type="button" onClick={() => go(i)} aria-current={i === cur ? 'true' : undefined}
                aria-label={t('heroShowN').replace('{n}', i + 1).replace('{total}', n)}
                className="grid h-11 w-11 place-items-center">
                <span className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${i === cur ? 'bg-[#111111]' : 'bg-[#E7E5E4]'}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
