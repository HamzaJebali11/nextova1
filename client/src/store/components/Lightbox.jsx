import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { optimizeImg } from '../../lib/image'
import { useDialogFocus } from '../../lib/useDialogFocus'
import { videoPoster, videoSource } from '../../lib/video'

// Use it with one picture:  <Lightbox url={...} onClose={...} />
// or with a gallery:        <Lightbox images={[url, ...]} index={2} onClose={...} />
// Gallery items can also be { type: 'video', url } (shown with controls, together with the pictures).
// screen-reader labels in the page language (the Lightbox can open outside the store context)
const LABELS = {
  en: { zoom: 'Zoom', close: 'Close', prev: 'Previous', next: 'Next' },
  ar: { zoom: 'تكبير', close: 'إغلاق', prev: 'السابق', next: 'التالي' },
}

export default function Lightbox({ url, images, index = 0, onClose, onVideoPlay }) {
  const L = LABELS[document.documentElement.lang === 'ar' ? 'ar' : 'en']
  const list = (images?.length ? images : [url]).map((x) => (typeof x === 'string' ? { url: x } : x))
  const [i, setI] = useState(Math.min(index, list.length - 1))
  const [zoomed, setZoomed] = useState(false)
  const scroller = useRef(null)
  const root = useRef(null)
  useDialogFocus(root)
  const many = list.length > 1
  const cur = list[i]
  const isVideo = cur.type === 'video'

  function show(next) {
    setI((next + list.length) % list.length)
    setZoomed(false)
    scroller.current?.scrollTo({ top: 0, left: 0 })
  }

  function toggleZoom() {
    setZoomed((z) => !z)
    scroller.current?.scrollTo({ top: 0, left: 0 })
  }

  // the page behind stays still while the picture is open
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') show(i - 1)
      if (e.key === 'ArrowRight') show(i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const iconBtn = 'grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/30'

  return createPortal(
    <motion.div ref={root} tabIndex={-1} role="dialog" aria-modal="true"
      className="nx-overlay fixed inset-0 z-[var(--z-modal)] flex flex-col bg-black/95 outline-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between p-3 text-white">
        <span className="ps-2 text-sm">{many ? `${i + 1} / ${list.length}` : ''}</span>
        <div className="flex gap-2">
          {!isVideo && (
            <button type="button" onClick={toggleZoom} className={iconBtn} aria-label={L.zoom}>
              {zoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
            </button>
          )}
          <button type="button" onClick={onClose} className={iconBtn} aria-label={L.close}><X size={22} /></button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={scroller}
          className="h-full overflow-auto overscroll-contain [touch-action:pan-x_pan-y_pinch-zoom]"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
          <div className="flex min-h-full min-w-full p-2"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            {isVideo ? (
              <video key={cur.url} src={videoSource(cur.url)} poster={videoPoster(cur.url) || undefined}
                controls autoPlay playsInline preload="auto" onPlay={() => onVideoPlay?.(cur.url)}
                className="m-auto max-h-[calc(100vh-6.5rem)] max-w-full bg-black" />
            ) : (
              <img src={optimizeImg(cur.url, zoomed ? 2000 : 1400)} alt="" draggable={false}
                onClick={toggleZoom}
                className={`m-auto ${
                  zoomed
                    ? 'w-[220%] max-w-none cursor-zoom-out md:w-[160%]'
                    : 'max-h-[calc(100vh-6.5rem)] max-w-full cursor-zoom-in object-contain'
                }`} />
            )}
          </div>
        </div>

        {many && (
          <>
            <button type="button" onClick={() => show(i - 1)} aria-label={L.prev}
              className={`${iconBtn} absolute start-3 top-1/2 -translate-y-1/2`}>
              <ChevronLeft size={22} className="rtl:rotate-180" />
            </button>
            <button type="button" onClick={() => show(i + 1)} aria-label={L.next}
              className={`${iconBtn} absolute end-3 top-1/2 -translate-y-1/2`}>
              <ChevronRight size={22} className="rtl:rotate-180" />
            </button>
          </>
        )}
      </div>
    </motion.div>,
    document.body
  )
}