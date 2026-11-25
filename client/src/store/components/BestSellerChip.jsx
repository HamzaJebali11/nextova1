import { useStore } from '../storeContext'

// neutral black "Best seller" chip (top sellers of the last 30 days, computed on the server)
export default function BestSellerChip({ small = false, className = '' }) {
  const { t } = useStore()
  return (
    <span className={`inline-flex items-center rounded-full bg-ink font-semibold text-white ${small ? 'mt-0.5 px-1.5 py-px text-[10px]' : 'px-2.5 py-1 text-xs'} ${className}`}>
      {t('bestSeller')}
    </span>
  )
}
