import { useState } from 'react'
import { Film, Trash2 } from 'lucide-react'
import { uploadVideo } from '../../lib/upload'

export default function ProductVideoField({ video, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function pick(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Please choose a video file (MP4 is best).')
      return
    }
    if (file.size > 60 * 1024 * 1024) {
      setError('This video is over 60 MB. Please compress it or make it shorter.')
      return
    }
    setUploading(true)
    setError('')
    try {
      onChange(await uploadVideo(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-semibold">Video <span className="text-xs font-normal text-gray-500">(optional)</span></h3>
        <p className="text-xs text-gray-500">
          A short vertical video (TikTok format, 9:16) showing how to use the product or the product in action. Best: MP4, 15 to 60 seconds.
          It plays on the product page above the description pictures. Leave it empty and nothing is shown.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</div>}

      <div className="flex flex-wrap items-center gap-4 rounded-xl border p-3">
        {video?.url ? (
          <video src={video.url} controls muted playsInline preload="metadata"
            className="aspect-[9/16] h-56 rounded-xl bg-black object-cover" />
        ) : (
          <div className="grid aspect-[9/16] h-56 place-items-center rounded-xl border-2 border-dashed text-gray-400">
            <Film size={32} />
          </div>
        )}

        <div className="flex flex-col gap-2 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">
            {uploading
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Film size={16} />}
            {uploading ? 'Uploading… (can take a minute)' : video?.url ? 'Replace video' : 'Upload video'}
            <input type="file" accept="video/*" hidden onChange={pick} disabled={uploading} />
          </label>
          {video?.url && (
            <button type="button" onClick={() => onChange({ url: '', publicId: '' })}
              className="inline-flex items-center gap-1 text-red-600 hover:underline">
              <Trash2 size={14} /> Remove video
            </button>
          )}
        </div>
      </div>
    </section>
  )
}