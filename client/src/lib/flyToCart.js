import { animate } from 'framer-motion'

// Flies a copy of a product picture in an arc to the header cart icon
// ([data-cart-icon]), then calls onLand. With reduced motion (or nothing to
// fly) it calls onLand straight away.
//   src:  picture url
//   from: DOMRect the picture starts from
export function flyToCart({ src, from, onLand }) {
  const done = () => {
    onLand?.()
    window.dispatchEvent(new Event('nx:cart-bump'))
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const target = document.querySelector('[data-cart-icon]')
  if (reduce || !target || !src || !from) {
    onLand?.()
    return
  }

  // make sure the header (and its cart icon) is on screen
  window.dispatchEvent(new Event('nx:show-header'))

  const size = Math.max(56, Math.min(from.width, from.height, 260))
  const sx = from.left + from.width / 2
  const sy = from.top + from.height / 2

  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')
  Object.assign(img.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: `${size}px`,
    height: `${size}px`,
    objectFit: 'cover',
    borderRadius: '18px',
    boxShadow: '0 10px 30px rgba(0,0,0,.25)',
    zIndex: '70',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    transform: `translate(${sx - size / 2}px, ${sy - size / 2}px)`,
  })
  document.body.appendChild(img)

  animate(0, 1, {
    duration: 0.7,
    ease: 'easeInOut',
    onUpdate: (t) => {
      // the target is read every frame: the header may still be sliding in
      const r = target.getBoundingClientRect()
      const ex = r.left + r.width / 2
      const ey = r.top + r.height / 2
      // control point above both ends gives the arc
      const cx = (sx + ex) / 2
      const cy = Math.min(sy, ey) - 140
      const u = 1 - t
      const x = u * u * sx + 2 * u * t * cx + t * t * ex
      const y = u * u * sy + 2 * u * t * cy + t * t * ey
      const scale = 1 - 0.85 * t
      img.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) scale(${scale})`
      img.style.opacity = String(1 - 0.4 * t)
    },
    onComplete: () => {
      img.remove()
      done()
    },
  })
}
