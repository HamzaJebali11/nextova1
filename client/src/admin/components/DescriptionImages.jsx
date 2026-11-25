import { useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'

const capCls = 'mt-1 w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm font-normal outline-none focus:ring-2 focus:ring-gray-900'

export default function DescriptionImages({ title, images, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function addFiles(e) {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    if (files.some((file) => !file.type.startsWith('image/') || file.size > 8 * 1024 * 1024)) {
      setError('Pictures must be images under 8 MB each.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const uploaded = []
      for (const file of files) uploaded.push(await uploadImage(file))
      onChange([...images, ...uploaded])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const setCaption = (i, key, lang, v) =>
    onChange(images.map((im, j) => (j === i ? { ...im, [key]: { ...(im[key] || {}), [lang]: v } } : im)))

  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700">
          {uploading
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <ImagePlus size={16} />}
          {uploading ? 'Uploading…' : 'Add pictures'}
          <input type="file" accept="image/*" multiple hidden onChange={addFiles} disabled={uploading} />
        </label>
      </div>

      {error && <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</div>}
      {images.length === 0 && <p className="text-xs text-gray-500">No pictures yet.</p>}

      <ul className="space-y-2">
        {images.map((im, i) => (
          <li key={im.url} className="grid gap-3 rounded-lg bg-gray-50 p-2 sm:grid-cols-[auto_1fr]">
            {/* picture + order controls */}
            <div className="flex items-start gap-2 sm:flex-col">
              <div className="relative">
                <img src={optimizeImg(im.url, 240)} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                <span className="absolute start-1 top-1 rounded bg-ink px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="rounded-lg border bg-white p-1.5 hover:bg-gray-100 disabled:opacity-30" title="Move up" aria-label="Move up"><ArrowUp size={15} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
                  className="rounded-lg border bg-white p-1.5 hover:bg-gray-100 disabled:opacity-30" title="Move down" aria-label="Move down"><ArrowDown size={15} /></button>
                <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))}
                  className="rounded-lg border bg-white p-1.5 text-red-600 hover:bg-red-50" title="Remove" aria-label="Remove picture"><Trash2 size={15} /></button>
              </div>
            </div>
            {/* text shown in the box next to this picture (empty = the text area stays blank) */}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-medium">Title (English)
                <input className={capCls} maxLength={60} value={im.title?.en || ''} onChange={(e) => setCaption(i, 'title', 'en', e.target.value)} />
              </label>
              <label className="block text-xs font-medium">Title (Arabic)
                <input dir="rtl" className={capCls} maxLength={60} value={im.title?.ar || ''} onChange={(e) => setCaption(i, 'title', 'ar', e.target.value)} />
              </label>
              <label className="block text-xs font-medium">Text (English)
                <textarea rows={3} className={capCls} maxLength={400} value={im.text?.en || ''} onChange={(e) => setCaption(i, 'text', 'en', e.target.value)} />
              </label>
              <label className="block text-xs font-medium">Text (Arabic)
                <textarea dir="rtl" rows={3} className={capCls} maxLength={400} value={im.text?.ar || ''} onChange={(e) => setCaption(i, 'text', 'ar', e.target.value)} />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}