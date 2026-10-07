import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import { Stars } from './Stars'

export default function ProductCard({ p, index = 0 }) {
  const { t, pick, money } = useStore()
  const { add } = useCart()
  const [added, setAdded] = useState(false)

  const out = p.stock <= 0
  const hasVariants = p.variants?.length > 0
  const hasPacks = p.packs?.length > 0
  const hasGift = !!p.freeGift?.enabled
  const needsPage = hasVariants || hasPacks || hasGift
  const off = p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0

  function quickAdd() {
    add({ productId: p._id, slug: p.slug, name: p.name, image: p.images?.[0]?.url, price: p.price })
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05 }}
      className="group h-full rounded-3xl border bg-white p-2.5 transition hover:shadow-lg">
      <Link to={`/product/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-gray-100">
        <img src={optimizeImg(p.images?.[0]?.url, 500)} alt={pick(p.name)} loading="lazy"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${out ? 'opacity-50' : ''}`} />
        {off > 0 && !out && (
          <span className="absolute start-2 top-2 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
            {off}% {t('off')}
          </span>
        )}
        {out && (
          <span className="absolute start-2 top-2 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
            {t('outOfStock')}
          </span>
        )}
        {!out && (hasPacks || hasGift) && (
          <span className="absolute bottom-2 start-2 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow">
            {hasGift ? `🎁 ${t('freeGift')}` : t('packDeal')}
          </span>
        )}
      </Link>

      <div className="px-1 pb-1 pt-3">
        <Link to={`/product/${p.slug}`} className="line-clamp-2 min-h-10 text-sm font-medium hover:text-emerald-600">
          {pick(p.name)}
        </Link>

        {p.ratingCount > 0 && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Stars value={p.ratingAvg} size={13} /> <span>({p.ratingCount})</span>
          </div>
        )}

        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-bold">{money(p.price)}</span>
          {off > 0 && <s className="text-xs text-gray-400">{money(p.compareAtPrice)}</s>}
        </div>

        {!out && (needsPage ? (
          <Link to={`/product/${p.slug}`}
            className="mt-3 block rounded-full border py-2 text-center text-sm font-medium transition hover:bg-gray-900 hover:text-white">
            {hasVariants ? t('selectOptions') : t('seeOffers')}
          </Link>
        ) : (
          <button onClick={quickAdd}
            className={`mt-3 w-full rounded-full py-2 text-sm font-medium transition ${
              added ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-white hover:bg-emerald-600'
            }`}>
            {added ? t('added') : t('addToCart')}
          </button>
        ))}
      </div>
    </motion.div>
  )
}