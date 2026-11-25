import { useEffect } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])'

// Keyboard rules for a dialog (pop-up, drawer, full-screen picture): focus moves into it when it opens,
// Tab / Shift+Tab stay inside it, and focus goes back to the button that opened it when it closes.
export function useDialogFocus(ref, active = true) {
  useEffect(() => {
    if (!active) return
    const opener = document.activeElement
    const frame = requestAnimationFrame(() => {
      const el = ref.current
      if (!el || el.contains(document.activeElement)) return
      const first = el.querySelector(FOCUSABLE)
      ;(first || el).focus({ preventScroll: true })
    })
    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const el = ref.current
      if (!el) return
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.getClientRects().length > 0)
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [ref, active])
}
