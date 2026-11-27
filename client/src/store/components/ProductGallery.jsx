import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Expand, Play } from 'lucide-react'
import { imgSrcSet, optimizeImg } from '../../lib/image'
import { GALLERY_SIZES } from '../../lib/prefetch'
import { trackVideoPlay, videoPoster } from '../../lib/video'
import { useStore } from '../storeContext'
import GalleryVideo from './GalleryVideo'
import Lightbox from './Lightbox'

const direction = () => (document.documentElement.dir === 'rtl' ? -1 : 1)

// pictures + the product video as one slide at the admin position (first / second (default) / last)
function buildSlides(images, video, position) {
  const pics = images.map((im) => ({ type: 'image', url: im.url }))
  if (!video?.url) return pics
  const at = position === 'first' ? 0 : position === 'last' ? pics.length : Math.min(1, pics.length)
  return [...pics.slice(0, at), { type: 'video', url: video.url }, ...pics.slice(at)]
}

// Thumbnail list.
// Desktop: a vertical column exactly as tall as the big picture (the column is stretched by the flex row and the
// list is absolutely positioned inside it, so it can never make the row taller and nothing jumps while loading).
// Phones: the horizontal strip under the picture.
// The list scrolls inside its box with no visible scrollbar; soft white fades (and on desktop small round arrows)
// show only where there are more thumbnails; the active thumbnail is kept in view (the page itself never scrolls).
function Thumbs({ slides, active, alt, onPick, keyOf }) {
  const { t } = useStore()
  const box = useRef(null)
  const [more, setMore] = useState({ up: false, down: false, start: false, end: false })

  const measure = useCallback(() => {
    const el = box.current
    if (!el) return
    const x = Math.abs(el.scrollLeft) // negative in RTL (Chrome, Firefox, Safari)
    const next = {
      up: el.scrollTop > 1,
      down: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      start: x > 1,
      end: x + el.clientWidth < el.scrollWidth - 1,
    }
    setMore((m) => (m.up === next.up && m.down === next.down && m.start === next.start && m.end === next.end ? m : next))
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    // pictures arriving can change the sizes too
    el.addEventListener('load', measure, true)
    return () => { ro?.disconnect(); el.removeEventListener('load', measure, true) }
  }, [measure, slides.length])

  // keep the active thumbnail in view, inside the list only (scrollBy on the list, never scrollIntoView)
  useEffect(() => {
    const el = box.current
    const th = el?.children[active]
    if (!el || !th) return
    const pad = 36 // clear of the fade
    const b = el.getBoundingClientRect()
    const r = th.getBoundingClientRect()
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const vertical = el.scrollHeight > el.clientHeight + 1
    if (vertical) {
      if (r.top < b.top + pad) el.scrollBy({ top: r.top - b.top - pad, behavior })
      else if (r.bottom > b.bottom - pad) el.scrollBy({ top: r.bottom - b.bottom + pad, behavior })
    } else if (el.scrollWidth > el.clientWidth + 1) {
      if (r.left < b.left + pad) el.scrollBy({ left: r.left - b.left - pad, behavior })
      else if (r.right > b.right - pad) el.scrollBy({ left: r.right - b.right + pad, behavior })
    }
  }, [active])

  const page = (dir) => {
    const el = box.current
    if (el) el.scrollBy({ top: dir * Math.max(80, el.clientHeight * 0.7), behavior: 'smooth' })
  }
  const arrow = 'pointer-events-auto grid h-11 w-11 place-items-center'
  const dot = 'glass grid h-7 w-7 place-items-center rounded-full text-ink transition duration-150'

  return (
    <div className="relative mt-1 min-w-0 md:order-first md:mt-0 md:w-[76px] md:shrink-0">
      <div ref={box} onScroll={measure}
        className="flex gap-2 overflow-x-auto overscroll-contain p-1 [scrollbar-width:none] md:absolute md:inset-0 md:flex-col md:overflow-y-auto md:overflow-x-hidden [&::-webkit-scrollbar]:hidden">
        {slides.map((s, i) => {
          const on = i === active
          const isVideo = s.type === 'video'
          const thumb = isVideo ? videoPoster(s.url, 160) : optimizeImg(s.url, 160)
          return (
            <button key={keyOf(s)} type="button" onClick={() => onPick(i)} aria-current={on ? 'true' : undefined}
              aria-label={isVideo ? t('videoTitle') : `${alt} ${i + 1}`}
              className={`glass relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-offset-2 transition duration-150 ${
                on ? 'opacity-100 ring-2 ring-ink' : 'opacity-75 ring-1 ring-line hover:opacity-100 hover:ring-gray-400'
              }`}>
              {thumb && <img src={thumb} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
              {isVideo && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/35 px-0.5 text-center text-white">
                  <Play size={16} className="fill-current" aria-hidden="true" />
                  <span className="line-clamp-2 text-[8.5px] font-semibold leading-tight">{t('videoTitle')}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* desktop: fades at the top / bottom with a round arrow (the fade never catches clicks, the arrow does) */}
      <div aria-hidden={!more.up} className={`nx-fade-up pointer-events-none absolute inset-x-0 top-0 hidden h-14 justify-center transition-opacity duration-150 md:flex ${more.up ? 'opacity-100' : 'opacity-0'}`}>
        {more.up && (
          <button type="button" onClick={() => page(-1)} aria-label={t('morePicturesUp')} className={`${arrow} -mt-1`}>
            <span className={dot}><ChevronUp size={16} aria-hidden="true" /></span>
          </button>
        )}
      </div>
      <div aria-hidden={!more.down} className={`nx-fade-down pointer-events-none absolute inset-x-0 bottom-0 hidden h-14 items-end justify-center transition-opacity duration-150 md:flex ${more.down ? 'opacity-100' : 'opacity-0'}`}>
        {more.down && (
          <button type="button" onClick={() => page(1)} aria-label={t('morePicturesDown')} className={`${arrow} -mb-1`}>
            <span className={dot}><ChevronDown size={16} aria-hidden="true" /></span>
          </button>
        )}
      </div>
      {/* phones: fades on the sides (end = right in English, left in Arabic) */}
      <div aria-hidden="true" className={`nx-fade-end pointer-events-none absolute inset-y-0 end-0 w-14 transition-opacity duration-150 md:hidden ${more.end ? 'opacity-100' : 'opacity-0'}`} />
      <div aria-hidden="true" className={`nx-fade-start pointer-events-none absolute inset-y-0 start-0 w-10 transition-opacity duration-150 md:hidden ${more.start ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  )
}

// focus = { url, n }: when it changes, the gallery shows that picture (used when a variant is chosen)
export default function ProductGallery({ images = [], video = null, videoPosition = 'second', alt = '', badge = null, focus = null }) {
  const { t } = useStore()
  const ref = useRef(null)
  const slides = buildSlides(images, video, videoPosition)
  const slidesRef = useRef(slides)
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(null) // index of the slide opened full screen

  useEffect(() => { slidesRef.current = slides })

  // auto-swipe state (see below)
  const activeRef = useRef(0)
  const zoomRef = useRef(null)
  const pausedUntil = useRef(0)
  const visible = useRef(true)
  const lastMove = useRef(0)
  const playing = useRef(false) // the gallery video is playing

  const go = useCallback((i) => {
    const el = ref.current
    if (!el) return
    const next = Math.max(0, Math.min(slidesRef.current.length - 1, i))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: direction() * next * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  useEffect(() => {
    if (!focus?.url) return
    const i = slidesRef.current.findIndex((s) => s.type === 'image' && s.url === focus.url)
    if (i >= 0) go(i)
    pausedUntil.current = Date.now() + 10000
  }, [focus, go])

  // AUTO-SWIPE: next slide every 5 s, looping forever.
  // Pauses ONLY while: the visitor touches / drags / scrolls the gallery or clicks a thumbnail or an arrow
  // (resumes 5 s after), a variant was just chosen (10 s), the video is PLAYING (a shown but not playing
  // video counts as a normal slide), the Lightbox is open, the tab is hidden, or the gallery is off screen.
  // When the video ends it moves on to the next slide and the normal timer starts again.
  // With "reduce motion" it keeps running but switches instantly (no slide). Works in RTL (go() handles it).
  useEffect(() => { activeRef.current = active; zoomRef.current = zoom })
  // the 5 s count starts again whenever the slide changes (auto, swipe, arrow, thumbnail or variant)
  useEffect(() => { lastMove.current = Date.now() }, [active])

  useEffect(() => {
    const el = ref.current
    if (!el || slides.length < 2) return
    let io
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting }, { threshold: 0.1 })
      io.observe(el)
    }
    lastMove.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      if (playing.current || !visible.current || document.hidden || zoomRef.current !== null || now < pausedUntil.current) {
        lastMove.current = now // a full 5 s again once it can run
        return
      }
      if (now - lastMove.current < 5000) return
      lastMove.current = now
      go((activeRef.current + 1) % slidesRef.current.length)
    }, 250)
    return () => {
      clearInterval(id)
      io?.disconnect()
    }
  }, [slides.length, go])

  const onVideoPlaying = useCallback((on) => {
    playing.current = on
    lastMove.current = Date.now()
  }, [])
  const onVideoEnded = useCallback(() => {
    if (slidesRef.current.length > 1) go((activeRef.current + 1) % slidesRef.current.length)
  }, [go])

  const touched = () => { pausedUntil.current = Math.max(pausedUntil.current, Date.now() + 5000) }
  const pause = {
    onPointerDown: touched, // touch, drag, thumbnail and arrow clicks
    onTouchStart: touched,
    onWheel: touched,
    onKeyDown: touched,
  }

  function onScroll() {
    const el = ref.current
    if (el && el.clientWidth) setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth))
  }

  if (slides.length === 0) {
    return <div className="relative aspect-square w-full rounded-[18px] bg-quiet">{badge}</div>
  }

  const roundBtn =
    'glass glass-on-photo z-[var(--z-content)] grid h-11 w-11 place-items-center rounded-full text-ink transition duration-150'
  const many = slides.length > 1
  const keyOf = (s) => `${s.type}:${s.url}`

  return (
    // self-start: the gallery is as tall as the big picture (never stretched by the buy box next to it),
    // so the thumbnail column, which fills the row, is exactly as tall as the big picture
    <div className="min-w-0 md:flex md:gap-4 md:self-start" {...pause}>
      <div className="relative min-w-0 self-start overflow-hidden rounded-[18px] bg-quiet md:flex-1">
        <div ref={ref} onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slides.map((s, i) => (
            <div key={keyOf(s)} data-gallery-active={i === active ? 'true' : undefined}
              className="aspect-square w-full shrink-0 snap-center">
              {s.type === 'video' ? (
                <GalleryVideo url={s.url} alt={alt} active={i === active} suspended={zoom !== null}
                  onPlaying={onVideoPlaying} onEnded={onVideoEnded} />
              ) : (
                <button type="button" onClick={() => setZoom(i)} className="block h-full w-full cursor-zoom-in">
                  {/* first slide picture: eager + high priority (largest thing on the first screen); others lazy */}
                  <img src={optimizeImg(s.url, 900)} srcSet={imgSrcSet(s.url)} sizes={GALLERY_SIZES}
                    width={900} height={900} alt={`${alt} ${i + 1}`}
                    loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'low'} decoding={i === 0 ? 'sync' : 'async'}
                    className="h-full w-full object-cover" />
                </button>
              )}
            </div>
          ))}
        </div>

        {badge}

        {/* expand: opens the Lightbox (pictures and the video) at the slide on screen */}
        <button type="button" onClick={() => setZoom(active)} aria-label={t('expand')} className={`${roundBtn} absolute end-3 top-3`}>
          <Expand size={18} />
        </button>

        {many && (
          <>
            <button type="button" aria-label={t('prev')} onClick={() => go(active - 1)} disabled={active === 0}
              className={`${roundBtn} absolute start-3 top-1/2 hidden -translate-y-1/2 disabled:opacity-30 md:grid`}>
              <ChevronLeft size={20} className="rtl:rotate-180" />
            </button>
            <button type="button" aria-label={t('next')} onClick={() => go(active + 1)} disabled={active === slides.length - 1}
              className={`${roundBtn} absolute end-3 top-1/2 hidden -translate-y-1/2 disabled:opacity-30 md:grid`}>
              <ChevronRight size={20} className="rtl:rotate-180" />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden">
              {slides.map((s, i) => (
                <span key={keyOf(s)}
                  className={`h-1.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,.25)] transition-all duration-150 ${i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/70'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {many && <Thumbs slides={slides} active={active} alt={alt} onPick={go} keyOf={keyOf} />}

      <AnimatePresence>
        {zoom !== null && (
          <Lightbox images={slides} index={zoom} onClose={() => setZoom(null)}
            onVideoPlay={(url) => trackVideoPlay(url, alt)} />
        )}
      </AnimatePresence>
    </div>
  )
}
