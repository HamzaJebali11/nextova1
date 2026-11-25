const isCloudinary = (url) => url.includes('res.cloudinary.com') && url.includes('/upload/')

// One picture at a given width: Cloudinary picks the best format (f_auto: AVIF/WebP) and quality (q_auto),
// and never upscales (c_limit). Other image hosts are returned unchanged.
export function optimizeImg(url, width = 600) {
  if (!url) return ''
  if (isCloudinary(url)) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`)
  }
  return url
}

// srcset with several widths, so a phone downloads a phone-sized picture and a desktop a sharp one
export function imgSrcSet(url, widths = [360, 540, 720, 960, 1280]) {
  if (!url || !isCloudinary(url)) return undefined
  return widths.map((w) => `${optimizeImg(url, w)} ${w}w`).join(', ')
}
