export const STATUSES = [
  // black / white / grey chips (orange is reserved for the highlight; red only for cancelled)
  { value: 'new', label: 'New', color: 'bg-ink text-white' },
  { value: 'on_hold', label: 'Needs confirmation', color: 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-gray-700 text-white' },
  { value: 'processing', label: 'Processing', color: 'bg-gray-200 text-ink' },
  { value: 'out_for_delivery', label: 'Out for delivery', color: 'bg-white text-ink ring-1 ring-inset ring-ink' },
  { value: 'delivered', label: 'Delivered', color: 'bg-gray-100 text-ink ring-1 ring-inset ring-gray-300' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200' },
  // the failed-delivery outcome (the stored value stays "returned", so older orders and reports keep working)
  { value: 'returned', label: 'Failed / returned', color: 'bg-gray-100 text-gray-600 line-through decoration-gray-400' },
]

// why a delivery failed (same keys as the server)
export const FAIL_REASONS = [
  { value: 'refused', label: 'Refused at the door' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'wrong_address', label: 'Wrong address or zone' },
  { value: 'changed_mind', label: 'Changed mind' },
  { value: 'other', label: 'Other' },
]
export const reasonLabel = (v) => FAIL_REASONS.find((r) => r.value === v)?.label || v || 'No reason saved'

export const statusInfo = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0]
export const money = (n) => `QAR ${Number(n || 0).toLocaleString('en-US')}`
export const fmtDate = (d) =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '–')
