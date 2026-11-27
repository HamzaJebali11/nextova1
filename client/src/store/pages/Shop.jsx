import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'
import { usePageMeta } from '../../lib/seo'
import ProductGrid from '../components/ProductGrid'
import Suggestions from '../components/Suggestions'

const SORTS = [
  ['newest', 'sortNewest'],
  ['price_asc', 'sortPriceAsc'],
  ['price_desc', 'sortPriceDesc'],
  ['popular', 'sortPopular'],
  ['rating', 'sortRating'],
]

export default function Shop() {
  const { t, pick, categories, settings } = useStore()
  const [sp, setSp] = useSearchParams()
  const [result, setResult] = useState({ qs: null, items: [], total: 0, pages: 1 })
  const [showFilters, setShowFilters] = useState(false)

  const qs = sp.toString()
  const page = Number(sp.get('page')) || 1

  useEffect(() => {
    let cancelled = false
    api(`/products?${qs}&limit=12`)
      .then((d) => { if (!cancelled) setResult({ qs, ...d }) })
      .catch(() => { if (!cancelled) setResult({ qs, items: [], total: 0, pages: 1 }) })
    return () => { cancelled = true }
  }, [qs])

  const loading = result.qs !== qs

  function update(patch) {
    const next = new URLSearchParams(sp)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined || v === false) next.delete(k)
      else next.set(k, String(v))
    })
    if (!('page' in patch)) next.delete('page')
    setSp(next)
  }

  const q = sp.get('q')
  const activeCat = categories.find((c) => c.slug === sp.get('category'))
  const heading = q ? `${t('resultsFor')} “${q}”` : activeCat ? pick(activeCat.name) : t('shop')
  // search results are not indexed (endless combinations); shop and category pages are
  usePageMeta({ title: `${heading} | ${settings.storeName || 'Nextova'}`, description: t('heroSub'), robots: q ? 'noindex' : undefined })

  const chips = [
    q && { key: 'q', label: `“${q}”` },
    activeCat && { key: 'category', label: pick(activeCat.name) },
    sp.get('minPrice') && { key: 'minPrice', label: `${t('min')}: ${sp.get('minPrice')}` },
    sp.get('maxPrice') && { key: 'maxPrice', label: `${t('max')}: ${sp.get('maxPrice')}` },
    sp.get('onSale') && { key: 'onSale', label: t('onlySale') },
    sp.get('inStock') && { key: 'inStock', label: t('inStockOnly') },
  ].filter(Boolean)

  const catCls = (active) =>
    `flex min-h-11 w-full items-center rounded-full px-3 text-start text-sm transition ${
      active ? 'bg-ink font-semibold text-white' : 'hover:bg-white hover:shadow-[0_2px_8px_rgba(17,17,17,0.08)]'
    }`

  const priceInput = (name, placeholder) => (
    <input key={`${name}-${sp.get(name)}`} type="number" min="0" placeholder={placeholder} aria-label={`${t('price')} ${placeholder}`}
      defaultValue={sp.get(name) || ''}
      onBlur={(e) => { if (e.target.value !== (sp.get(name) || '')) update({ [name]: e.target.value }) }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="glass-input w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
  )

  return (
    <div className="nx-page py-8">
      {/* Title banner (shop, category pages, search): "LG1" clear liquid glass on the white page, light shadow.
          The look is in .nx-glass-title (index.css); same width as the product grid, nothing behind it. */}
      <div className="glass-orange glass-sheen nx-glass-title mb-8">
        <div className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="nx-glass-name min-w-0 break-words">{heading}</h1>
          <p className="nx-glass-count min-w-20">{loading ? '…' : `${result.total} ${t('results')}`}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button onClick={() => setShowFilters(!showFilters)}
          className="glass-btn gap-2 px-4 text-sm lg:hidden">
          <SlidersHorizontal size={16} /> {t('filters')}
        </button>
        {chips.map((c) => (
          <button key={c.key} onClick={() => update({ [c.key]: '' })}
            className="glass-btn gap-1 px-3 text-sm">
            {c.label} <X size={14} />
          </button>
        ))}
        <select value={sp.get('sort') || 'newest'}
          onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}
          aria-label={t('sortBy')} className="glass-input ms-auto rounded-full px-4 text-sm outline-none">
          {SORTS.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
        </select>
      </div>

      <div className="grid gap-8 lg:grid-cols-[clamp(240px,18vw,280px)_minmax(0,1fr)]">
        <aside className={`${showFilters ? 'block' : 'hidden'} glass h-fit space-y-6 rounded-3xl p-5 lg:sticky lg:top-24 lg:block`}>
          <div>
            <h2 className="mb-2 text-base font-semibold">{t('categories')}</h2>
            <ul className="space-y-1">
              <li><button onClick={() => update({ category: '' })} className={catCls(!sp.get('category'))}>{t('allCategories')}</button></li>
              {categories.map((c) => (
                <li key={c._id} className={c.parent ? 'ms-4' : ''}>
                  <button onClick={() => update({ category: c.slug })} className={catCls(sp.get('category') === c.slug)}>
                    {pick(c.name)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold">{t('price')}</h2>
            <div className="flex items-center gap-2">
              {priceInput('minPrice', t('min'))}
              <span className="text-gray-400">–</span>
              {priceInput('maxPrice', t('max'))}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <label className="glass-btn w-full cursor-pointer justify-start gap-2 px-4 font-medium">
              <input type="checkbox" checked={sp.get('onSale') === 'true'}
                onChange={(e) => update({ onSale: e.target.checked ? 'true' : '' })} />
              {t('onlySale')}
            </label>
            <label className="glass-btn w-full cursor-pointer justify-start gap-2 px-4 font-medium">
              <input type="checkbox" checked={sp.get('inStock') === 'true'}
                onChange={(e) => update({ inStock: e.target.checked ? 'true' : '' })} />
              {t('inStockOnly')}
            </label>
          </div>

          {chips.length > 0 && (
            <button onClick={() => setSp({})} className="text-sm font-medium text-emerald-600 hover:underline">
              {t('clearFilters')}
            </button>
          )}
        </aside>

        <div className="min-w-0">
          <ProductGrid items={result.items} loading={loading} count={8} compact />

          {result.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm">
              <button disabled={page <= 1} onClick={() => update({ page: page - 1 })}
                className="glass-btn px-4 disabled:opacity-40">{t('prev')}</button>
              <span>{page} / {result.pages}</span>
              <button disabled={page >= result.pages} onClick={() => update({ page: page + 1 })}
                className="glass-btn px-4 disabled:opacity-40">{t('next')}</button>
            </div>
          )}

          {!loading && result.items.length < 4 && <Suggestions />}
        </div>
      </div>
    </div>
  )
}