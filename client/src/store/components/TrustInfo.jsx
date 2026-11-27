import { Banknote, RotateCcw, Truck } from 'lucide-react'
import { useStore } from '../storeContext'

// Trust row: three small icons with text (no payment card icons)
const ITEMS = [
  ['trustRowCod', Banknote],
  ['trustEasyReturns', RotateCcw],
  ['trustDelivery2', Truck],
]

export default function TrustInfo() {
  const { t } = useStore()
  return (
    <ul className="grid grid-cols-3 gap-2 text-center">
      {ITEMS.map(([key, Icon]) => (
        <li key={key} className="glass flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs leading-snug text-gray-600">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-quiet text-ink" aria-hidden="true">
            <Icon size={18} />
          </span>
          {t(key)}
        </li>
      ))}
    </ul>
  )
}
