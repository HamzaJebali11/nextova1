// Sales event countdown, from the REAL end time only (never loops or restarts).
// Returns null once the event has ended, so the banner disappears by itself.
const OFFSET = 3 * 60 * 60 * 1000 // Qatar is UTC+3 all year
const DAY = 24 * 60 * 60 * 1000
const qDay = (ms) => Math.floor((ms + OFFSET) / DAY) // Qatar calendar day number

export function eventCountdown(endsAt, now = Date.now()) {
  const end = new Date(endsAt).getTime()
  const left = end - now
  if (!Number.isFinite(end) || left < 0) return null
  if (left <= DAY) {
    const s = Math.floor(left / 1000)
    const pad = (n) => String(n).padStart(2, '0')
    return { kind: 'clock', text: `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` }
  }
  const days = qDay(end) - qDay(now) // calendar days until the last day
  if (days <= 0) return { kind: 'today' }
  if (days === 1) return { kind: 'tomorrow' }
  return { kind: 'days', n: days }
}

// the "off" text: display only, from the two numbers typed in the admin
export function rangeText(ev, t) {
  if (!ev) return ''
  return ev.minPct > 0
    ? t('eventRange').replace('{x}', ev.minPct).replace('{y}', ev.maxPct)
    : t('eventUpTo').replace('{y}', ev.maxPct)
}
