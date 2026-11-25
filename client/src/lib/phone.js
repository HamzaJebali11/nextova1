// Qatar mobile numbers (same rules as server/src/utils/phone.js; keep both in sync).
// 8 digits starting with 3, 5, 6 or 7; +974 / 974 / 00974 prefixes, spaces and dashes are accepted.

// what the customer typed -> up to 8 local digits (prefix removed), for the input boxes with a fixed +974
export function toLocalDigits(input) {
  let d = String(input ?? '').replace(/\D/g, '')
  if (d.startsWith('00974')) d = d.slice(5)
  else if (d.startsWith('974') && d.length > 8) d = d.slice(3)
  return d.slice(0, 8)
}

export function qatarLocal(raw) {
  let d = String(raw ?? '').trim().replace(/[\s\-.()/]/g, '')
  if (!/^\+?\d+$/.test(d)) return null
  d = d.replace(/^\+/, '')
  if (d.startsWith('00974')) d = d.slice(5)
  else if (d.startsWith('974') && d.length === 11) d = d.slice(3)
  return /^[3567]\d{7}$/.test(d) ? d : null
}

export function isFakeLocal(d) {
  if (!d) return true
  if (/^(\d)\1{7}$/.test(d) || /(\d)\1{6}/.test(d)) return true
  const step = (k) => [...d].every((c, i) => i === 0 || Number(c) === (Number(d[i - 1]) + k + 10) % 10)
  if (step(1) || step(-1)) return true
  if (/^(\d\d)\1{3}$/.test(d)) return true
  return false
}

// true when the number is a real-looking Qatar mobile number
export const isValidQatarPhone = (raw) => {
  const d = qatarLocal(raw)
  return !!d && !isFakeLocal(d)
}

// +974XXXXXXXX or null
export const normalizeQatarPhone = (raw) => (isValidQatarPhone(raw) ? `+974${qatarLocal(raw)}` : null)

// digits for https://wa.me/<digits> (old stored numbers are normalised when possible)
export function waDigits(phone) {
  const n = normalizeQatarPhone(phone)
  if (n) return n.slice(1)
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits.length === 8 ? `974${digits}` : digits
}
