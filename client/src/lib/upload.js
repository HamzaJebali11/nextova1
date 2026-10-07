import { api } from './api'

export async function uploadImage(file, { review = false } = {}) {
  const sig = await api(review ? '/uploads/review-sign' : '/uploads/sign', { method: 'POST' })
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sig.apiKey)
  form.append('timestamp', sig.timestamp)
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)
  if (sig.allowedFormats) form.append('allowed_formats', sig.allowedFormats)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
  return { url: data.secure_url, publicId: data.public_id }
}