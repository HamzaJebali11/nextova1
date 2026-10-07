import ProductCard from './ProductCard'
import { useStore } from '../storeContext'

const wrap = 'flex flex-wrap justify-center gap-3 md:gap-5'
const basis = 'basis-[calc(50%_-_0.375rem)] md:basis-[calc(33.333%_-_0.84rem)] lg:basis-[calc(25%_-_0.95rem)]'
const basisCompact = 'basis-[calc(50%_-_0.375rem)] md:basis-[calc(33.333%_-_0.84rem)] xl:basis-[calc(25%_-_0.95rem)]'

export default function ProductGrid({ items, loading, count = 8, compact = false }) {
  const { t } = useStore()
  const b = compact ? basisCompact : basis

  if (loading) {
    return (
      <div className={wrap}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`${b} animate-pulse`}>
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
        <div key={p._id} className={`${b} min-w-0`}>
          <ProductCard p={p} index={i} />
        </div>
      ))}
    </div>
  )
}