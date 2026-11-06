import { MapPin } from 'lucide-react'

export function WhatsAppState({ order }) {
  const s = order.whatsapp?.status
  if (!s) return null
  if (s === 'failed') {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
        title={order.whatsapp?.error || ''}>
        WhatsApp not delivered: call him
      </span>
    )
  }
  const label = s === 'read' ? 'WhatsApp read' : s === 'delivered' ? 'WhatsApp delivered' : 'WhatsApp sent'
  const tone = s === 'sent' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>
}

export function LocationState({ order }) {
  if (!order.location?.url) return null
  return (
    <a href={order.location.url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
      onClick={(e) => e.stopPropagation()}>
      <MapPin size={12} /> Location received
    </a>
  )
}