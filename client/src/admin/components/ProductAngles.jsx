import { useState } from 'react'
import { Check, Copy, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'
import { blankAngle } from './anglesForm'

const MAX = 10
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'
const slugify = (v) => v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 30)

export default function ProductAngles({ angles, onChange, productSlug, photos = [] }) {
  const [copied, setCopied] = useState('')
  const [uploading, setUploading] = useState(-1)

  const setAngle = (i, patch) => onChange(angles.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const setLang = (i, key, lang, v) => setAngle(i, { [key]: { ...angles[i][key], [lang]: v } })
  const slugs = angles.map((a) => a.slug)
  const dupe = (s) => s && slugs.filter((x) => x === s).length > 1

  async function upload(i, e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(i)
    try {
      const img = await uploadImage(file)
      setAngle(i, { image: img.url })
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(-1)
    }
  }

  async function copy(slug) {
    const url = `${window.location.origin}/product/${productSlug}?angle=${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(slug)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Ad angles <span className="text-xs font-normal text-gray-500">({angles.length}/{MAX})</span></h3>
          <p className="text-xs text-gray-500">
            One landing page per ad message. The link <span className="font-mono">?angle=slug</span> replaces the title, sub-line,
            bullets and first picture; price, packs and the order form stay the same. Orders remember the angle.
          </p>
        </div>
        <button type="button" disabled={angles.length >= MAX} onClick={() => onChange([...angles, blankAngle()])}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40">
          <Plus size={16} /> Add angle
        </button>
      </div>

      {angles.map((a, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block w-40">
              <span className="mb-1 block text-xs font-medium">Slug *</span>
              <input className={`${inputCls} font-mono ${dupe(a.slug) ? 'border-red-500' : ''}`} placeholder="cold"
                value={a.slug} onChange={(e) => setAngle(i, { slug: slugify(e.target.value) })} />
            </label>
            <button type="button" disabled={!productSlug || !a.slug} onClick={() => copy(a.slug)}
              title={productSlug ? '' : 'Save the product first'}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40">
              {copied === a.slug ? <Check size={15} /> : <Copy size={15} />} {copied === a.slug ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" onClick={() => onChange(angles.filter((_, j) => j !== i))}
              className="ms-auto flex items-center gap-1 text-sm text-red-600 hover:underline"><Trash2 size={14} /> Remove</button>
          </div>
          {dupe(a.slug) && <p className="text-xs font-semibold text-red-600">Two angles use this slug: each needs its own.</p>}
          {productSlug && a.slug && (
            <p className="break-all font-mono text-[11px] text-gray-500">{window.location.origin}/product/{productSlug}?angle={a.slug}</p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="Headline (English)" maxLength={90}
              value={a.headline.en} onChange={(e) => setLang(i, 'headline', 'en', e.target.value)} />
            <input dir="rtl" className={inputCls} placeholder="العنوان (Arabic)" maxLength={90}
              value={a.headline.ar} onChange={(e) => setLang(i, 'headline', 'ar', e.target.value)} />
            <input className={inputCls} placeholder="Sub-headline (English)" maxLength={140}
              value={a.subheadline.en} onChange={(e) => setLang(i, 'subheadline', 'en', e.target.value)} />
            <input dir="rtl" className={inputCls} placeholder="العنوان الفرعي (Arabic)" maxLength={140}
              value={a.subheadline.ar} onChange={(e) => setLang(i, 'subheadline', 'ar', e.target.value)} />
            <textarea rows={3} className={inputCls} placeholder={'Benefit bullets (English), one per line\nKeeps water cold 24 h'}
              value={a.bullets.en} onChange={(e) => setLang(i, 'bullets', 'en', e.target.value)} />
            <textarea dir="rtl" rows={3} className={inputCls} placeholder="النقاط (Arabic)، نقطة في كل سطر"
              value={a.bullets.ar} onChange={(e) => setLang(i, 'bullets', 'ar', e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium">Hero picture (optional, shown first)</div>
            <div className="flex flex-wrap items-center gap-2">
              {a.image && (
                <img src={optimizeImg(a.image, 120)} alt="" className="h-14 w-14 rounded-lg object-cover ring-2 ring-ink" />
              )}
              {photos.filter((p) => p.url !== a.image).slice(0, 8).map((p) => (
                <button key={p.url} type="button" onClick={() => setAngle(i, { image: p.url })} title="Use this photo"
                  className="h-12 w-12 overflow-hidden rounded-lg opacity-70 hover:opacity-100">
                  <img src={optimizeImg(p.url, 100)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100">
                {uploading === i ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload
                <input type="file" accept="image/*" hidden disabled={uploading === i} onChange={(e) => upload(i, e)} />
              </label>
              {a.image && <button type="button" onClick={() => setAngle(i, { image: '' })} className="text-sm text-red-600 hover:underline">Remove picture</button>}
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
