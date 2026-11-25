// Delivery estimate line on the product page, from the REAL clock in Qatar time (UTC+3, no daylight saving).
// Before today's cut-off: the time left until it ({ h, m }); after it: null (no countdown, nothing faked).
const OFFSET = 3 * 60 * 60 * 1000

export function timeToCutoff(cutoff = '17:00', now = Date.now()) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(cutoff))
  if (!m) return null
  const qatar = new Date(now + OFFSET) // read with UTC getters = Qatar wall clock
  const minutesNow = qatar.getUTCHours() * 60 + qatar.getUTCMinutes()
  const minutesCut = Number(m[1]) * 60 + Number(m[2])
  const left = minutesCut - minutesNow
  if (left <= 0) return null
  return { h: Math.floor(left / 60), m: left % 60 }
}
