import { useEffect, useRef } from 'react'
import { useStore } from '../storeContext'

const isCloudinaryVideo = (url) => url.includes('res.cloudinary.com') && url.includes('/video/upload/')

// a light, phone-friendly version of the video (converted by Cloudinary)
const source = (url) =>
  isCloudinaryVideo(url) ? url.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,q_auto,w_720/') : url

// first frame as a poster image
const poster = (url) =>
  isCloudinaryVideo(url)
    ? url.replace('/video/upload/', '/video/upload/so_0,w_700,f_jpg,q_auto/').replace(/\.[a-z0-9]+$/i, '.jpg')
    : undefined

export default function ProductVideo({ video }) {
  const { t } = useStore()
  const ref = useRef(null)
  const url = video?.url

  // plays (muted) while it is on screen, pauses when it scrolls away
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) el.play().catch(() => {})
        else el.pause()
      },
      { threshold: [0, 0.6] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [url])

  if (!url) return null

  return (
    <section className="mx-auto mt-16 max-w-sm px-4">
      <h2 className="mb-6 text-center text-2xl font-bold">{t('videoTitle')}</h2>
      <div className="overflow-hidden rounded-[2rem] border-4 border-gray-900 bg-black shadow-2xl">
        <video ref={ref} src={source(url)} poster={poster(url)} muted loop playsInline controls preload="metadata"
          className="aspect-[9/16] w-full bg-black object-cover" />
      </div>
    </section>
  )
}