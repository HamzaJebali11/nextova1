export const STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'processing', label: 'Processing', color: 'bg-amber-100 text-amber-700' },
  { value: 'out_for_delivery', label: 'Out for delivery', color: 'bg-purple-100 text-purple-700' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  { value: 'returned', label: 'Returned', color: 'bg-gray-200 text-gray-700' },
]

export const statusInfo = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0]
export const money = (n) => `QAR ${Number(n || 0).toLocaleString('en-US')}`
export const fmtDate = (d) =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })