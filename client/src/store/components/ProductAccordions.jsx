import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore } from '../storeContext'

// "Delivery information", "Returns" and "About the product" (native details/summary: keyboard accessible).
// Texts: the product's own text, else the Settings text (EN/AR). An accordion without text is not shown.
// The first one starts open on desktop; all start closed on phones.
export default function ProductAccordions({ product, about }) {
  const { t, pick, settings } = useStore()
  const [desktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  const items = [
    ['delivery', t('accDelivery'), pick(product.deliveryInfo) || pick(settings.deliveryInfo)],
    ['returns', t('accReturns'), pick(product.returnsInfo) || pick(settings.returnsInfo)],
    ['about', t('accAbout'), about],
  ].filter(([, , text]) => text && text.trim())
  if (items.length === 0) return null

  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4 shadow-e1">
      {items.map(([key, title, text], i) => (
        <details key={key} open={desktop && i === 0} className="nx-acc group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold [&::-webkit-details-marker]:hidden">
            {title}
            <ChevronDown size={18} aria-hidden="true" className="shrink-0 transition duration-150 group-open:rotate-180" />
          </summary>
          <p className="whitespace-pre-line pb-4 text-sm leading-relaxed text-gray-700">{text}</p>
        </details>
      ))}
    </div>
  )
}
