import { useLayoutEffect } from 'react'
import { useAnimate, useReducedMotion } from 'framer-motion'

// Calm scroll reveal for the storefront: fade in + move up 14px, 400 ms ease-out, once.
// Safe by design:
//  - content is VISIBLE by default; it is only hidden (just before paint) when it starts BELOW the first
//    screen, so the first screen shows at once (no layout shift, nothing waits for JavaScript)
//  - no IntersectionObserver or reduced motion: nothing is ever hidden
//  - a safety timer shows the content anyway if the observer never fires
// delay: stagger for cards in a row (e.g. index * 0.06)
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const [scope, animate] = useAnimate()
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    const el = scope.current
    if (!el || reduce || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight) return // in the first screen: never animated

    animate(el, { opacity: 0, y: 14 }, { duration: 0 })
    let done = false
    const show = () => {
      if (done) return
      done = true
      animate(el, { opacity: 1, y: 0 }, { duration: 0.4, delay, ease: 'easeOut' })
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        show()
        io.disconnect()
      }
    }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    // never leave content hidden: if the visitor jumps (anchor, search) or the observer misbehaves
    const safety = setInterval(() => {
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight && r.bottom > 0) show()
      if (done) clearInterval(safety)
    }, 1500)
    return () => {
      io.disconnect()
      clearInterval(safety)
      if (!done) animate(el, { opacity: 1, y: 0 }, { duration: 0 })
    }
  }, [animate, scope, reduce, delay])

  return <Tag ref={scope} className={className} {...rest}>{children}</Tag>
}
