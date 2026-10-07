import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, PenLine, X } from 'lucide-react'
import { api } from '../../lib/api'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { Stars, StarInput } from './Stars'
import Lightbox from './Lightbox'
import ReviewCarousel from './ReviewCarousel'

const inputCls =
  'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'

function ReviewForm({ productId }) {
  const { t } = useStore()
  const [f, setF] = useState({ name: '', rating: 0, title: '', comment: '', website: '' })
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  async function addFiles(e) {
    const files = [...e.target.files].slice(0, 3 - images.length)
    e.target.value = ''
    if (!files.length) return
    if (files.some((file) => !file.type.startsWith('image/') || file.size > 6 * 1024 * 1024)) {
      setError(t('errPhoto'))
      return
    }
    setUploading(true)
    setError('')
    try {
      const up = []
      for (const file of files) up.push(await uploadImage(file, { review: true }))
      setImages((s) => [...s, ...up].slice(0, 3))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (f.name.trim().length < 2) return setError(t('errReviewName'))
    if (!f.rating) return setError(t('errRating'))
    setBusy(true)
    try {
      await api('/reviews', {
        method: 'POST',
        body: {
          productId, name: f.name.trim(), rating: f.rating,
          title: f.title.trim() || undefined, comment: f.comment.trim() || undefined,
          images, website: f.website,
        },
      })
      setDone(true)
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' · ') || err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <div className="mb-8 rounded-2xl bg-emerald-50 p-5 text-center font-medium text-emerald-700">{t('reviewThanks')}</div>
  }

  return (
    <form onSubmit={submit} noValidate className="relative mb-8 space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website}
        onChange={(e) => set('website', e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <div>
        <div className="mb-1 text-sm font-medium">{t('yourRating')}</div>
        <StarInput value={f.rating} onChange={(v) => set('rating', v)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('yourName')}</span>
          <input maxLength={60} value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('reviewTitle')}</span>
          <input maxLength={100} value={f.title} onChange={(e) => set('title', e.target.value)} className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('yourReview')}</span>
        <textarea rows={3} maxLength={1000} value={f.comment} onChange={(e) => set('comment', e.target.value)} className={inputCls} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {images.map((im, i) => (
          <div key={im.url} className="relative">
            <img src={optimizeImg(im.url, 160)} alt="" className="h-16 w-16 rounded-xl object-cover" />
            <button type="button" onClick={() => setImages((s) => s.filter((_, j) => j !== i))}
              className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-900 text-white">
              <X size={12} />
            </button>
          </div>
        ))}
        {images.length < 3 && (
          <label className="flex h-16 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-4 text-sm text-gray-600 hover:border-emerald-500 hover:text-emerald-600">
            {uploading
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              : <ImagePlus size={20} />}
            <span>{t('addPhotos')} <span className="text-xs text-gray-400">({t('photosHint')})</span></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles} disabled={uploading} />
          </label>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <button disabled={busy || uploading}
        className="rounded-full bg-gray-900 px-6 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">
        {busy ? t('submitting') : t('submitReview')}
      </button>
    </form>
  )
}

export default function Reviews({ productId }) {
  const { t } = useStore()
  const [data, setData] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    let cancelled = false
    api(`/reviews/product/${productId}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData({ items: [], summary: { avg: 0, count: 0, dist: {} } }) })
    return () => { cancelled = true }
  }, [productId])

  if (!data) return <div className="mt-16 h-40 animate-pulse rounded-3xl bg-gray-100" />

  const { items, summary } = data
  const { avg, count, dist } = summary
  const photos = items.flatMap((r) => r.images || []).slice(0, 6)
  const gridClass = photos.length
    ? 'lg:grid-cols-[12rem_1fr_16rem] md:grid-cols-[12rem_1fr]'
    : 'md:grid-cols-[12rem_1fr]'

  return (
    <section id="reviews" className="mt-16 scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{t('reviews')}</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-full border-2 border-gray-900 px-5 py-2 text-sm font-semibold transition hover:bg-gray-900 hover:text-white">
          <PenLine size={16} /> {t('writeReview')}
        </button>
      </div>

      {count > 0 ? (
        <div className={`mb-8 grid items-center gap-6 rounded-3xl border bg-gradient-to-br from-gray-50 to-white p-6 ${gridClass}`}>
          <div className="text-center">
            <div className="text-5xl font-extrabold">{avg.toFixed(1)}</div>
            <div className="mt-1 flex justify-center"><Stars value={avg} size={22} /></div>
            <div className="mt-1 text-sm text-gray-500">{count} {t('reviewsCount')}</div>
          </div>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((s) => (
              <div key={s} className="flex items-center gap-3 text-sm">
                <span className="w-3 text-gray-600">{s}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${((dist[s] || 0) / count) * 100}%` }} />
                </div>
                <span className="w-6 text-end text-gray-500">{dist[s] || 0}</span>
              </div>
            ))}
          </div>

          {photos.length > 0 && (
            <div className="md:col-span-2 lg:col-span-1">
              <div className="mb-2 text-sm font-semibold">{t('customerPhotos')}</div>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((im) => (
                  <button key={im.url} onClick={() => setZoom(im.url)}>
                    <img src={optimizeImg(im.url, 200)} alt="" className="aspect-square w-full rounded-xl object-cover transition hover:opacity-80" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-8 rounded-3xl border border-dashed bg-gray-50 p-8 text-center">
          <div className="mb-2 flex justify-center"><Stars value={0} size={26} /></div>
          <p className="text-gray-500">{t('noReviews')}</p>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <ReviewForm productId={productId} />
          </motion.div>
        )}
      </AnimatePresence>

      {items.length > 0 && <ReviewCarousel items={items} />}

      <AnimatePresence>{zoom && <Lightbox url={zoom} onClose={() => setZoom(null)} />}</AnimatePresence>
    </section>
  )
}