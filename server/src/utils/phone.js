import { z } from 'zod'

// Qatar mobile numbers: 8 digits starting with 3, 5, 6 or 7, with an optional +974 / 974 / 00974 prefix,
// spaces, dashes, dots or brackets. Stored and shown as +974XXXXXXXX.
// The same rules live in client/src/lib/phone.js (keep both in sync).

export const PHONE_MESSAGE = 'Please enter a valid Qatar mobile number, for example 5xxxxxxx'

// the 8 local digits, or null when it is not a Qatar mobile number
export function qatarLocal(raw) {
  let d = String(raw ?? '').trim().replace(/[\s\-.()/]/g, '')
  if (!/^\+?\d+$/.test(d)) return null
  d = d.replace(/^\+/, '')
  if (d.startsWith('00974')) d = d.slice(5)
  else if (d.startsWith('974') && d.length === 11) d = d.slice(3)
  return /^[3567]\d{7}$/.test(d) ? d : null
}

// obviously fake: one digit repeated, 7+ equal digits in a row, a simple counting sequence or a repeated pair
export function isFakeLocal(d) {
  if (!d) return true
  if (/^(\d)\1{7}$/.test(d) || /(\d)\1{6}/.test(d)) return true
  const step = (k) => [...d].every((c, i) => i === 0 || Number(c) === (Number(d[i - 1]) + k + 10) % 10)
  if (step(1) || step(-1)) return true
  if (/^(\d\d)\1{3}$/.test(d)) return true // 35353535
  return false
}

// +974XXXXXXXX for a valid, not obviously fake number; null otherwise
export function normalizeQatarPhone(raw) {
  const d = qatarLocal(raw)
  return d && !isFakeLocal(d) ? `+974${d}` : null
}

// key used to match the same customer across old and new orders: the last 8 digits
// (older orders may have been stored in another format; they are never rewritten)
export function phoneKey(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(-8) : ''
}

// Mongo condition that finds a stored phone (any old format) by its key
export function phoneMatch(key, field = 'customer.phone') {
  if (!/^\d{8}$/.test(key)) return { [field]: '__no_match__' }
  return { [field]: { $regex: `${key.split('').join('[\\s\\-.]?')}\\s*$` } }
}

// zod field for every route that accepts a customer phone
export const qatarPhoneField = () => z.string().trim().max(40)
  .transform((s, ctx) => {
    const n = normalizeQatarPhone(s)
    if (!n) {
      ctx.addIssue({ code: 'custom', message: PHONE_MESSAGE })
      return z.NEVER
    }
    return n
  })
