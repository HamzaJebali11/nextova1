// AD ANGLES: /product/<slug>?angle=<angle> (or ?a=<angle>) shows that angle's title block.
// The angle is remembered for the visit (sessionStorage) and sent with the order and the unfinished-order lead.

const KEY = 'nx_angle'

function read() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null
  } catch {
    return null
  }
}

// the active angle for this product, or null (unknown slug = normal page)
export function resolveAngle(product, search) {
  const angles = product?.angles || []
  if (angles.length === 0) return null
  const p = new URLSearchParams(search)
  const wanted = (p.get('angle') || p.get('a') || '').trim().toLowerCase()
  if (wanted) {
    const found = angles.find((a) => a.slug === wanted)
    if (!found) return null
    try { sessionStorage.setItem(KEY, JSON.stringify({ slug: found.slug, product: product._id })) } catch { /* optional */ }
    return found
  }
  // no ?angle in the link: keep the angle seen earlier in this visit for this product
  const saved = read()
  if (saved && saved.product === product._id) return angles.find((a) => a.slug === saved.slug) || null
  return null
}

// what is sent with orders and leads
export function getAngle() {
  const a = read()
  return a?.slug ? { slug: a.slug, product: a.product } : undefined
}
