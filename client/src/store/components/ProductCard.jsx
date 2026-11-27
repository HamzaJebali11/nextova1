import { useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from './Reveal'
import { imgSrcSet, optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { priceRange, priceText } from '../../lib/options'
import { useCart } from '../../cart/cartContext'
import { Stars } from './Stars'
import BestSellerChip from './BestSellerChip'

export default function ProductCard({ p, index = 0 }) {
  const { t, pick, money } = useStore()
  const { add } = useCart()
  const [added, setAdded] = useState(false)

  const out = p.stock <= 0
  const hasVariants = p.variants?.length > 0
  const hasPacks = p.packs?.length > 0
  const hasGift = !!p.freeGift?.enabled
  const needsPage = hasVariants || hasPacks || hasGift
  const ranged = priceRange(p).min !== priceRange(p).max // option types with different prices: "From"
  const off = !ranged && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0

  function quickAdd() {
    add({ productId: p._id, slug: p.slug, name: p.name, image: p.images?.[0]?.url, price: p.price })
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  return (
    <Reveal delay={(index % 4) * 0.06}
      className="glass nx-lift group h-full p-2.5">
      <Link to={`/product/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-quiet">
        <img src={optimizeImg(p.images?.[0]?.url, 500)} srcSet={imgSrcSet(p.images?.[0]?.url, [240, 360, 500, 720])}
          sizes="(min-width: 1024px) 25vw, 50vw" width={500} height={500} decoding="async" alt={pick(p.name)} loading="lazy"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${out ? 'opacity-50' : ''}`} />
        {off > 0 && !out && (
          <span className="absolute start-2 top-2 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">
            {off}% {t('off')}
          </span>
        )}
        {out && (
          <span className="absolute start-2 top-2 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
            {t('outOfStock')}
          </span>
        )}
        {p.isBestSeller && !out && <BestSellerChip className="absolute end-2 top-2" />}
        {!out && (hasPacks || hasGift) && (
          <span className="absolute bottom-2 start-2 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow">
            {hasGift ? `🎁 ${t('freeGift')}` : t('packDeal')}
          </span>
        )}
      </Link>

      <div className="px-1 pb-1 pt-3">
        <Link to={`/product/${p.slug}`} className="line-clamp-2 min-h-11 text-sm font-medium hover:text-emerald-600">
          {pick(p.name)}
        </Link>

        {p.ratingCount > 0 && (
          <div className="mt-1 flex items-center gap-1 text-xs text-ink">
            <Stars value={p.ratingAvg} size={13} /> <span className="tabular-nums">({p.ratingCount})</span>
          </div>
        )}

        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-bold">{priceText(p, money, t)}</span>
          {off > 0 && <s className="text-xs text-gray-500">{money(p.compareAtPrice)}</s>}
        </div>

        {!out && (needsPage ? (
          <Link to={`/product/${p.slug}`}
            className="glass-btn mt-3 flex w-full text-center text-sm">
            {hasVariants ? t('selectOptions') : t('seeOffers')}
          </Link>
        ) : (
          <button onClick={quickAdd}
            className={`mt-3 w-full text-sm ${added ? 'btn-primary-glass min-h-11' : 'glass-btn'}`}>
            {added ? t('added') : t('addToCart')}
          </button>
        ))}
      </div>
    </Reveal>
  )
}