import { trackCustom } from './pixel'

// Product video helpers (Cloudinary: a light phone-friendly MP4, and the first frame as a JPG poster)
export const isCloudinaryVideo = (url = '') => url.includes('res.cloudinary.com') && url.includes('/video/upload/')

export const videoSource = (url) =>
  isCloudinaryVideo(url) ? url.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,q_auto,w_720/') : url

// first frame (so_0) as a picture; size = square crop for gallery slides / thumbnails, else the full frame
export const videoPoster = (url, size) => {
  if (!isCloudinaryVideo(url)) return ''
  const tr = size ? `so_0,w_${size},h_${size},c_fill,f_auto,q_auto` : 'so_0,w_1080,f_auto,q_auto'
  return url.replace('/video/upload/', `/video/upload/${tr}/`).replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg')
}

// Meta Pixel custom event "VideoPlay": only the first time a product's video starts in this visit
const played = new Set()
export function trackVideoPlay(url, name) {
  if (played.has(url)) return
  played.add(url)
  try {
    if (sessionStorage.getItem(`nx_vp:${url}`)) return
    sessionStorage.setItem(`nx_vp:${url}`, '1')
  } catch { /* storage blocked: the in-memory check above still limits it to once per page visit */ }
  trackCustom('VideoPlay', { content_name: name, content_type: 'product' })
}
