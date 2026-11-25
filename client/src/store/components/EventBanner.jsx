import { useEffect, useState } from 'react'
import { eventCountdown, rangeText } from '../../lib/eventTime'
import { useStore } from '../storeContext'

// Slim sales event banner under the menu (part of the header, so it hides and shows with it).
// DISPLAY ONLY: the percentage is the text typed in the admin; prices are never changed by an event.
export default function EventBanner() {
  const { event, t, pick } = useStore()
  const [now, setNow] = useState(() => Date.now())
  const cd = event ? eventCountdown(event.endsAt, now) : null

  // tick every second in the last 24 hours, otherwise every minute; stops when it has ended
  useEffect(() => {
    if (!event || !cd) return
    const id = setInterval(() => setNow(Date.now()), cd.kind === 'clock' ? 1000 : 60000)
    return () => clearInterval(id)
  }, [event, cd?.kind]) // eslint-disable-line react-hooks/exhaustive-deps

  // more white in the glass while the page is scrolled (content passes under it)
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8)
  useEffect(() => {
    if (!event) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = 0; setScrolled(window.scrollY > 8) })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [event])

  if (!event || !cd) return null

  const time =
    cd.kind === 'clock' ? `${t('eventEndsIn')} ${cd.text}`
      : cd.kind === 'today' ? t('eventEndsToday')
        : cd.kind === 'tomorrow' ? t('eventEndsTomorrow')
          : t('eventDaysLeft').replace('{n}', cd.n)

  return (
    // light glass panel (see .nx-event in index.css): the outer box carries the glass, border and glow;
    // the inner row cuts long names. Same 28 px height as before (1 px border + 3 px padding).
    <div className="nx-event mx-auto mt-1.5 max-w-[1180px] rounded-full" data-scrolled={scrolled ? 'true' : undefined}
      role="status" aria-live="off">
      <div className="flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap px-3 py-[3px] text-[11px] leading-5 sm:text-[12px] md:text-[13px]">
        <span className="min-w-0 truncate font-semibold">{pick(event.name)}</span>
        <span aria-hidden="true" className="h-3 w-px shrink-0 bg-ink/20" />
        <span className="shrink-0 font-bold text-accent">{rangeText(event, t)}</span>
        <span aria-hidden="true" className="h-3 w-px shrink-0 bg-ink/20" />
        <span className="shrink-0 font-bold tabular-nums" dir="ltr">{time}</span>
      </div>
    </div>
  )
}
