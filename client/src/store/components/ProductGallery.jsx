import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import Lightbox from './Lightbox'

const direction = () => (document.documentElement.dir === 'rtl' ? -1 : 1)

// focus = { url, n }: when it changes, the gallery shows that picture (used when a variant is chosen)
export default function ProductGallery({ images = [], alt = '', badge = null, focus = null }) {
  const { t } = useStore()
  const ref = useRef(null)
  const imagesRef = useRef(images)
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(null) // index of the picture opened full screen

  useEffect(() => { imagesRef.current = images })

  const go = useCallback((i) => {
    const el = ref.current
    if (!el) return
    const next = Math.max(0, Math.min(imagesRef.current.length - 1, i))
    el.scrollTo({ left: direction() * next * el.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!focus?.url) return
    const i = imagesRef.current.findIndex((im) => im.url === focus.url)
    if (i >= 0) go(i)
  }, [focus, go])

  function onScroll() {
    const el = ref.current
    if (el && el.clientWidth) setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth))
  }

  if (images.length === 0) {
    return <div className="relative aspect-square rounded-3xl bg-gray-100">{badge}</div>
  }

  const arrow =
    'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow transition hover:bg-white md:grid'

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-gray-100">
        <div ref={ref} onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((im, i) => (
            <button key={im.url} type="button" onClick={() => setZoom(i)}
              className="aspect-square w-full shrink-0 snap-center cursor-zoom-in">
              <img src={optimizeImg(im.url, 900)} alt={`${alt} ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>

        {badge}

        {images.length > 1 && (
          <>
            <button type="button" aria-label={t('prev')} onClick={() => go(active - 1)} disabled={active === 0}
              className={`${arrow} start-3 disabled:opacity-30`}>
              <ChevronLeft size={20} className="rtl:rotate-180" />
            </button>
            <button type="button" aria-label={t('next')} onClick={() => go(active + 1)} disabled={active === images.length - 1}
              className={`${arrow} end-3 disabled:opacity-30`}>
              <ChevronRight size={20} className="rtl:rotate-180" />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((im, i) => (
                <span key={im.url}
                  className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((im, i) => (
            <button key={im.url} type="button" onClick={() => go(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                i === active ? 'border-emerald-500' : 'border-transparent opacity-70 hover:opacity-100'
              }`}>
              <img src={optimizeImg(im.url, 120)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {zoom !== null && (
          <Lightbox images={images.map((im) => im.url)} index={zoom} onClose={() => setZoom(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}