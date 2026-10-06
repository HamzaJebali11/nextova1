import { statusInfo } from '../../lib/constants'

export default function StatusBadge({ status }) {
  const s = statusInfo(status)
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.color}`}>{s.label}</span>
}