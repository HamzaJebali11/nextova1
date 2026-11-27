import { useEffect, useRef, useState } from 'react'
import { Play, Volume2, VolumeX } from 'lucide-react'
import { trackVideoPlay, videoPoster, videoSource } from '../../lib/video'
import { useStore } from '../storeContext'

// The product video as one gallery slide. Until the customer taps play only the poster (first frame) loads,
// like a normal picture; the <video> element (and the file) is created on tap. It plays inline, muted at
// first (sound button + native controls), no loop. It pauses when the customer swipes to another slide,
// opens the Lightbox, or scrolls the gallery out of view.
export default function GalleryVideo({ url, alt, active, suspended, onPlaying, onEnded }) {
  const { t } = useStore()
  const ref = useRef(null)
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(true)
  const poster = videoPoster(url, 900)

  useEffect(() => {
    if (!active || suspended) ref.current?.pause()
  }, [active, suspended])

  useEffect(() => {
    const el = ref.current
    if (!el || !started || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || e.intersectionRatio < 0.5) el.pause()
    }, { threshold: [0, 0.5] })
    io.observe(el)
    return () => io.disconnect()
  }, [started])

  function toggleSound() {
    const el = ref.current
    if (!el) return
    el.muted = !el.muted
    if (!el.muted && el.paused) el.play().catch(() => {})
  }

  return (
    <div className="relative h-full w-full bg-ink">
      {poster && (
        <img src={poster} alt={`${alt} – ${t('videoTitle')}`} width={900} height={900} loading="lazy" decoding="async"
          className="absolute inset-0 h-full w-full object-cover" />
      )}

      {started ? (
        <>
          <video ref={ref} src={videoSource(url)} poster={poster || undefined} autoPlay muted playsInline controls preload="auto"
            width={900} height={900}
            onPlay={() => { onPlaying(true); trackVideoPlay(url, alt) }}
            onPause={() => onPlaying(false)}
            onEnded={() => { onPlaying(false); onEnded() }}
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
            className="absolute inset-0 h-full w-full bg-ink object-contain" />
          <button type="button" onClick={toggleSound} aria-label={muted ? t('soundOn') : t('soundOff')} aria-pressed={!muted}
            className="glass glass-on-photo absolute end-3 top-16 z-[var(--z-content)] grid h-11 w-11 place-items-center rounded-full text-ink transition duration-150">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setStarted(true)} aria-label={`${t('playVideo')}: ${t('videoTitle')}`}
          className="group absolute inset-0 grid place-items-center">
          <span className="flex flex-col items-center gap-3">
            <span className="glass glass-on-photo grid h-[72px] w-[72px] place-items-center rounded-full text-ink transition duration-150 group-hover:scale-105">
              <Play size={30} className="ml-1 fill-current" aria-hidden="true" />
            </span>
            <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">{t('videoTitle')}</span>
          </span>
        </button>
      )}
    </div>
  )
}
