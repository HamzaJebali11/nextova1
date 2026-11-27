import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Image as ImageIcon, ImagePlus, PenLine, X } from 'lucide-react'
import { api } from '../../lib/api'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { friendlyError } from '../friendlyError'
import { Stars, StarInput } from './Stars'
import Lightbox from './Lightbox'
import Reveal from './Reveal'
import Section from './Section'

const inputCls =
  'glass-input w-full px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-200'

function ReviewForm({ productId }) {
  const { t, lang } = useStore()
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
      setError(err.network ? t('errNetwork') : t('errPhoto'))
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
      setError(friendlyError(err, t, lang))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <div className="mb-8 rounded-2xl bg-emerald-50 p-5 text-center font-medium text-emerald-700">{t('reviewThanks')}</div>
  }

  return (
    <form onSubmit={submit} noValidate className="glass relative mb-8 space-y-4 rounded-2xl p-5">
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
            <span>{t('addPhotos')} <span className="text-xs text-gray-500">({t('photosHint')})</span></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles} disabled={uploading} />
          </label>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <button disabled={busy || uploading}
        className="btn-primary-glass px-6 py-3">
        {busy ? t('submitting') : t('submitReview')}
      </button>
    </form>
  )
}

const PAGE = 6
const LONG = 240 // characters before "Read more"

function ReviewCard({ r, onPhoto }) {
  const { t, lang } = useStore()
  const [more, setMore] = useState(false)
  const long = (r.comment || '').length > LONG
  const date = new Date(r.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <article className="glass nx-lift flex h-full flex-col rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-quiet text-sm font-bold" aria-hidden="true">
            {(r.name || '?').charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="font-semibold">{r.name}</div>
            <div className="text-xs text-gray-500">{date}</div>
          </div>
        </div>
        <Stars value={r.rating} size={15} />
      </div>
      {r.verified && (
        <div className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-quiet px-2.5 py-0.5 text-xs font-semibold">
          <BadgeCheck size={14} aria-hidden="true" /> {t('verifiedBuyer')}
        </div>
      )}
      {r.title && <h3 className="mt-3 font-semibold">{r.title}</h3>}
      {r.comment && (
        <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700 ${long && !more ? 'line-clamp-4' : ''}`}>{r.comment}</p>
      )}
      {long && (
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
          className="mt-1 w-fit text-sm font-semibold underline underline-offset-2">
          {more ? t('readLess') : t('readMore')}
        </button>
      )}
      {r.images?.length > 0 && (
        <div className="mt-3 flex gap-2">
          {r.images.map((im, i) => (
            <button key={im.url} type="button" onClick={() => onPhoto(r.images, i)} aria-label={`${t('customerPhotos')} ${i + 1}`}>
              <img src={optimizeImg(im.url, 160)} alt="" width={64} height={64} loading="lazy" decoding="async"
                className="h-16 w-16 rounded-xl object-cover transition hover:opacity-80" />
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

// Reviews section: summary with a clickable 5-to-1 distribution, sort and "with photos" filter,
// 6 reviews first then "Show more reviews". Real data only (approved reviews from the server).
export default function Reviews({ productId, headingRef }) {
  const { t } = useStore()
  const [data, setData] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [zoom, setZoom] = useState(null) // { images, index }
  const [stars, setStars] = useState(0) // 0 = all
  const [photosOnly, setPhotosOnly] = useState(false)
  const [sort, setSort] = useState('newest')
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    let cancelled = false
    api(`/reviews/product/${productId}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData({ items: [], summary: { avg: 0, count: 0, dist: {} } }) })
    return () => { cancelled = true }
  }, [productId])

  const writeBtn = (
    <button type="button" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}
      className="glass-btn gap-2 px-5 text-sm">
      <PenLine size={16} /> {t('writeReview')}
    </button>
  )

  const items = data?.items || []
  const { avg = 0, count = 0, dist = {} } = data?.summary || {}
  const filtered = items
    .filter((r) => (!stars || r.rating === stars) && (!photosOnly || r.images?.length > 0))
    .sort((a, b) => sort === 'high' ? b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt)
      : sort === 'low' ? a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt))
  const visible = filtered.slice(0, shown)
  const withPhotos = items.filter((r) => r.images?.length).length
  const reset = () => setShown(PAGE)

  return (
    <Section id="reviews" title={t('reviews')} action={writeBtn} headingRef={headingRef}>
      {!data && <div className="h-40 animate-pulse rounded-2xl bg-quiet" />}

      {data && count === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-quiet p-8 text-center">
          <div className="mb-2 flex justify-center"><Stars value={0} size={26} /></div>
          <p className="font-semibold">{t('noReviewsTitle')}</p>
          <p className="mt-1 text-sm text-gray-600">{t('noReviews')}</p>
        </div>
      )}

      {data && count > 0 && (
        <div className="glass grid items-center gap-6 rounded-2xl p-5 md:grid-cols-[12rem_1fr] md:p-6">
          <div className="text-center">
            <div className="text-5xl font-extrabold">{avg.toFixed(1)}</div>
            <div className="mt-1 flex justify-center"><Stars value={avg} size={22} /></div>
            <div className="mt-1 text-sm text-gray-600">{count} {t('reviewsCount')}</div>
          </div>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const n = dist[s] || 0
              const active = stars === s
              return (
                <button key={s} type="button" disabled={!n} aria-pressed={active}
                  onClick={() => { setStars(active ? 0 : s); reset() }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-sm transition disabled:opacity-40 ${active ? 'bg-white shadow-e1' : 'hover:bg-white'}`}>
                  <span className="w-12 text-start text-gray-700">{t('starsN').replace('{n}', s)}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${(n / count) * 100}%` }} />
                  </span>
                  <span className="w-6 text-end text-gray-600">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mt-6 overflow-hidden">
            <ReviewForm productId={productId} />
          </motion.div>
        )}
      </AnimatePresence>

      {count > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">{t('sortBy')}</span>
              <select value={sort} onChange={(e) => { setSort(e.target.value); reset() }}
                className="glass-input min-h-11 rounded-full px-4 text-sm">
                <option value="newest">{t('sortNewest')}</option>
                <option value="high">{t('sortHighest')}</option>
                <option value="low">{t('sortLowest')}</option>
              </select>
            </label>
            {withPhotos > 0 && (
              <button type="button" aria-pressed={photosOnly} onClick={() => { setPhotosOnly(!photosOnly); reset() }}
                aria-pressed={photosOnly} className="glass-btn gap-1.5 px-4 text-sm font-medium">
                <ImageIcon size={15} aria-hidden="true" /> {t('withPhotos')} ({withPhotos})
              </button>
            )}
            {stars > 0 && (
              <button type="button" onClick={() => { setStars(0); reset() }}
                className="glass-btn gap-1.5 px-4 text-sm font-medium">
                {t('starsN').replace('{n}', stars)} <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="mt-6 text-sm text-gray-600">{t('noReviewsFilter')}</p>
          ) : (
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {visible.map((r, i) => (
                <Reveal as="li" key={r._id} delay={(i % 2) * 0.06}>
                  <ReviewCard r={r} onPhoto={(images, index) => setZoom({ images, index })} />
                </Reveal>
              ))}
            </ul>
          )}

          {filtered.length > shown && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={() => setShown((n) => n + PAGE)}
                className="glass-btn px-6 text-sm">
                {t('showMoreReviews')} ({filtered.length - shown})
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {zoom && <Lightbox images={zoom.images.map((im) => im.url)} index={zoom.index} onClose={() => setZoom(null)} />}
      </AnimatePresence>
    </Section>
  )
}
