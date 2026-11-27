import ProductCard from './ProductCard'
import { useStore } from '../storeContext'

// Product grid (home sections, shop, suggestions): uses the whole page width.
// Columns: 2 on phones, 3 from 640px, 4 from 1024px, 5 from 1440px, 6 from 1920px. Cards keep square pictures.
// (The older "compact" prop is still accepted by callers but no longer changes the columns.)
const wrap = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 wide:grid-cols-5 ultra:grid-cols-6 gap-3 md:gap-5'

export default function ProductGrid({ items, loading, count = 8 }) {
  const { t } = useStore()

  if (loading) {
    return (
      <div className={wrap}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square rounded-3xl bg-gray-200" />
            <div className="mt-3 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) return <p className="py-16 text-center text-gray-500">{t('noProducts')}</p>

  return (
    <div className={wrap}>
      {items.map((p, i) => (
        <div key={p._id} className="min-w-0">
          <ProductCard p={p} index={i} />
        </div>
      ))}
    </div>
  )
}
