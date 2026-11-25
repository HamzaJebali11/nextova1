import { useEffect, useState } from 'react'
import { Eye, ShoppingBag, ThumbsUp } from 'lucide-react'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'

// Social proof under the title: REAL numbers only, from the server (orders, visitor counter, approved reviews).
// Each part hides when it has no data; the whole bar stays hidden until the product reaches the
// minimum "bought" set in admin Settings (default 5).
export default function ProofBar({ slug }) {
  const { t } = useStore()
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    api(`/products/${encodeURIComponent(slug)}/proof`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug])

  if (!data?.show) return null

  const parts = [
    data.bought > 0 && { icon: ShoppingBag, text: t('proofBought').replace('{n}', data.bought) },
    data.viewedWeek > 0 && { icon: Eye, text: t('proofViewed').replace('{n}', data.viewedWeek) },
    data.liked && { icon: ThumbsUp, text: `${t('proofLiked').replace('{p}', data.liked.pct)} ${t('proofReviews').replace('{n}', data.liked.reviews)}` },
  ].filter(Boolean)
  if (parts.length === 0) return null

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600" aria-label={t('proofLabel')}>
      {parts.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-1.5">
          <Icon size={14} aria-hidden="true" className="shrink-0" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}
