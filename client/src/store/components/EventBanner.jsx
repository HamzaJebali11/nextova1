import { useEffect, useState } from 'react'
import { eventCountdown, rangeParts } from '../../lib/eventTime'
import { useStore } from '../storeContext'

// Sales event banner under the menu (part of the header, so it hides and shows with it).
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

  if (!event || !cd) return null

  const time =
    cd.kind === 'clock' ? `${t('eventEndsIn')} ${cd.text}`
      : cd.kind === 'today' ? t('eventEndsToday')
        : cd.kind === 'tomorrow' ? t('eventEndsTomorrow')
          : t('eventDaysLeft').replace('{n}', cd.n)

  return (
    <EventBannerView name={pick(event.name)} range={rangeParts(event, t)} time={time} />
  )
}

// The banner itself ("G4" white glass with an orange glow edge, see .nx-event in index.css). Also used by the
// admin "Banner preview". Phones: name + discount on the first line, the countdown pill below, start aligned
// (left in English, right in Arabic). From 640 px: one centred row.
export function EventBannerView({ name, range, time }) {
  return (
    <div className="nx-event relative z-[var(--z-event-banner)] mt-1.5" role="status" aria-live="off">
      <div className="flex flex-col items-start justify-center gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="nx-event-name min-w-0 break-words">{name}</span>
          <span className="nx-event-main">
            {range.map((p, i) => (p.hot ? <span key={i} className="nx-event-hot">{p.text}</span> : <span key={i}>{p.text}</span>))}
          </span>
        </div>
        <span className="nx-event-pill shrink-0 tabular-nums" dir="ltr">{time}</span>
      </div>
    </div>
  )
}
