import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { timeToCutoff } from '../../lib/deliveryTime'
import { useStore } from '../storeContext'

// "Order within 3h 12m and get it within 2 working days" before today's cut-off (Qatar time, admin setting);
// after it, or when the countdown is switched off: "Order now and get it within 2 working days".
export default function DeliveryEstimate() {
  const { t, settings } = useStore()
  const [now, setNow] = useState(() => Date.now())
  const on = settings.deliveryCountdown !== false
  const left = on ? timeToCutoff(settings.deliveryCutoff || '17:00', now) : null

  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [on])

  const text = left
    ? t('deliveryWithin').replace('{t}', t('hoursMinutes').replace('{h}', left.h).replace('{m}', left.m))
    : t('deliveryNow')

  return (
    <p className="glass flex items-start gap-2 rounded-2xl px-4 py-3 text-sm text-ink">
      <Truck size={18} aria-hidden="true" className="mt-px shrink-0" />
      <span>{text}</span>
    </p>
  )
}
