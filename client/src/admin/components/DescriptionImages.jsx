import { useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'

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
          <li key={im.url} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
            <span className="w-5 text-center text-xs text-gray-400">{i + 1}</span>
            <img src={optimizeImg(im.url, 200)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate text-xs text-gray-500">Shown in this order</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="rounded-lg border bg-white p-2 hover:bg-gray-100 disabled:opacity-30" title="Move up"><ArrowUp size={16} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
              className="rounded-lg border bg-white p-2 hover:bg-gray-100 disabled:opacity-30" title="Move down"><ArrowDown size={16} /></button>
            <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="rounded-lg border bg-white p-2 text-red-600 hover:bg-red-50" title="Remove"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}