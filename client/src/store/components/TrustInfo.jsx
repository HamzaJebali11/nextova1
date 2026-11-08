
import { Banknote, RefreshCcw, ShieldCheck, Truck } from 'lucide-react'
import { useStore } from '../storeContext'

const ITEMS = [
  ['delivery', Truck, 'trustDelivery'],
  ['payment', Banknote, 'trustPayment'],
  ['returns', RefreshCcw, 'trustReturns'],
  ['support', ShieldCheck, 'trustSupport'],
]

export default function TrustInfo() {
  const { settings, pick, t } = useStore()

  const rows = ITEMS
    .map(([key, Icon, label]) => ({
      key,
      Icon,
      label,
      text: pick(settings.trust?.[key]),
    }))
    .filter((item) => item.text)

  if (rows.length === 0) return null

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {rows.map(({ key, Icon, label, text }) => (
        <div
          key={key}
          className="flex gap-3 rounded-2xl bg-gray-50 p-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm">
            <Icon size={18} />
          </span>

          <div className="text-sm">
            <div className="font-semibold">{t(label)}</div>
            <div className="text-gray-600">{text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
