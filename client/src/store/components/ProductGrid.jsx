import ProductCard from './ProductCard'
import { useStore } from '../storeContext'

export default function ProductGrid({ items, loading, count = 8 }) {
  const { t } = useStore()
  const grid = 'grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4'

  if (loading) {
    return (
      <div className={grid}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square rounded-2xl bg-gray-200" />
            <div className="mt-3 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) return <p className="py-16 text-center text-gray-500">{t('noProducts')}</p>

  return (
    <div className={grid}>
      {items.map((p, i) => <ProductCard key={p._id} p={p} index={i} />)}
    </div>
  )
}