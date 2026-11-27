import { Link } from 'react-router-dom'
import { imgSrcSet, optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { priceRange, priceText } from '../../lib/options'
import BestSellerChip from './BestSellerChip'
import { Stars } from './Stars'

// Marketplace product card: square picture, small category label, name (2 lines), price (+ old price crossed),
// the saving tag when there is one, and a grey "Sold out" label. Neutral; soft shadow on hover only.
export default function ProductTile({ p, sizes = '(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 50vw' }) {
  const { t, pick, money } = useStore()
  const out = !(p.stock > 0)
  const ranged = priceRange(p).min !== priceRange(p).max // option types with different prices: "From"
  const off = !ranged && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
  const img = p.images?.[0]?.url
  return (
    <Link to={`/product/${p.slug}`}
      className="glass nx-lift group block h-full p-2.5">
      <span className="relative block aspect-square overflow-hidden rounded-xl bg-quiet">
        {img && (
          <img src={optimizeImg(img, 400)} srcSet={imgSrcSet(img, [200, 300, 400, 600])} sizes={sizes}
            width={400} height={400} alt="" loading="lazy" decoding="async"
            className={`h-full w-full object-cover ${out ? 'opacity-60' : ''}`} />
        )}
        {out ? (
          <span className="absolute start-2 top-2 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{t('soldOut')}</span>
        ) : off > 0 && (
          <span className="absolute start-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
            {t('youSave').replace('{amt}', `${off}%`)}
          </span>
        )}
        {p.isBestSeller && !out && <BestSellerChip small className="absolute end-2 top-2 !mt-0" />}
      </span>
      <span className="block px-1 pb-1 pt-2">
        {p.category?.name && <span className="block truncate text-[11px] uppercase tracking-wide text-gray-500">{pick(p.category.name)}</span>}
        <span className="line-clamp-2 min-h-10 text-sm font-medium leading-snug">{pick(p.name)}</span>
        {p.ratingCount > 0 && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-ink">
            <Stars value={p.ratingAvg} size={12} /> <span className="tabular-nums">({p.ratingCount})</span>
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-bold">{priceText(p, money, t)}</span>
          {off > 0 && <s className="text-xs text-gray-500">{money(p.compareAtPrice)}</s>}
        </span>
      </span>
    </Link>
  )
}
