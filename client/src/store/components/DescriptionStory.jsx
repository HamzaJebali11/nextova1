import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { imgSrcSet, optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import Lightbox from './Lightbox'
import Reveal from './Reveal'

const FIRST = 6 // pictures shown before "Show more"

// Build the mosaic rows. Every picture is the same size: a square (1:1, object-fit cover) as wide as one
// of the two columns, with the same rounded corners.
//   picture WITH text    -> picture on one side, its text tile on the other; sides keep alternating
//   two pictures WITHOUT -> side by side (the two columns)
//   one picture WITHOUT  -> alone, centred, still one column wide
// On phones: one picture per row at full width (the text tile goes under it). Only when NO picture of the
// set has text do the pictures stay two per row, so sizes are never mixed on one page.
// Only the title/text written in the admin is shown; no automatic text.
function buildRows(items) {
  const rows = []
  let side = 0 // alternates for picture+text rows (0 = picture at the start side)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.hasText) {
      rows.push({ type: 'pair', a: it, picAtEnd: side % 2 === 1 })
      side += 1
      continue
    }
    const next = items[i + 1]
    if (next && !next.hasText) {
      rows.push({ type: 'two', a: it, b: next })
      i += 1
      continue
    }
    rows.push({ type: 'single', a: it })
  }
  return rows
}

function TextTile({ it, className = '' }) {
  return (
    <div className={`glass flex flex-col justify-center rounded-[14px] p-5 md:p-6 ${className}`}>
      {it.title && <h3 className="text-lg font-bold leading-snug">{it.title}</h3>}
      {it.text && <p className={`whitespace-pre-line leading-relaxed text-gray-600 ${it.title ? 'mt-2' : ''}`}>{it.text}</p>}
    </div>
  )
}

// half = also half width on phones (only when the whole set has no text)
function Pic({ it, half, alt, onZoom }) {
  return (
    <Reveal className="h-full">
      <button type="button" onClick={() => onZoom(it.index)} aria-label={`${alt} ${it.index + 1}`}
        className="block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[14px] bg-quiet">
        <img
          src={optimizeImg(it.url, 700)}
          srcSet={imgSrcSet(it.url, [320, 480, 720, 960])}
          sizes={half ? '(min-width: 940px) 445px, 50vw' : '(min-width: 940px) 445px, (min-width: 640px) 50vw, 100vw'}
          width={700}
          height={700}
          alt={`${alt} ${it.index + 1}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </button>
    </Reveal>
  )
}

export default function DescriptionStory({ images = [], alt = '' }) {
  const { t, pick } = useStore()
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(null)

  if (images.length === 0) return null

  const all = images.map((im, index) => {
    const title = pick(im.title)
    const text = pick(im.text)
    return { url: im.url, index, title, text, hasText: !!(title || text) }
  })
  const noText = all.every((it) => !it.hasText)
  const rows = buildRows(open ? all : all.slice(0, FIRST))

  return (
    <div>
      <div className="space-y-[10px]">
        {rows.map((r) => {
          if (r.type === 'two') {
            return (
              <div key={`t${r.a.index}`} className={`grid gap-[10px] ${noText ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                <Pic it={r.a} half={noText} alt={alt} onZoom={setZoom} />
                <Pic it={r.b} half={noText} alt={alt} onZoom={setZoom} />
              </div>
            )
          }
          if (r.type === 'single') {
            // same width as one column: half of the row minus half the gap
            return (
              <div key={`s${r.a.index}`} className="flex justify-center">
                <div className={noText ? 'w-[calc(50%-5px)]' : 'w-full sm:w-[calc(50%-5px)]'}>
                  <Pic it={r.a} half={noText} alt={alt} onZoom={setZoom} />
                </div>
              </div>
            )
          }
          // picture + its text tile; on phones the tile goes under the picture
          return (
            <div key={`p${r.a.index}`} className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
              <div className={r.picAtEnd ? 'sm:order-2' : ''}><Pic it={r.a} alt={alt} onZoom={setZoom} /></div>
              <Reveal className={`flex ${r.picAtEnd ? 'sm:order-1' : ''}`}><TextTile it={r.a} className="w-full" /></Reveal>
            </div>
          )
        })}
      </div>

      {images.length > FIRST && !open && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setOpen(true)} aria-expanded={open}
            className="glass-btn gap-2 px-6 text-sm">
            {t('showMore')} ({images.length - FIRST})
            <ChevronDown size={18} aria-hidden="true" />
          </button>
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
