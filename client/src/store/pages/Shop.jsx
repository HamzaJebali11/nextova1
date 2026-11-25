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
    `block w-full rounded-xl px-3 py-2 text-start text-sm transition ${
      active ? 'bg-emerald-50 font-semibold text-emerald-700' : 'hover:bg-quiet'
    }`

  const priceInput = (name, placeholder) => (
    <input key={`${name}-${sp.get(name)}`} type="number" min="0" placeholder={placeholder} aria-label={`${t('price')} ${placeholder}`}
      defaultValue={sp.get(name) || ''}
      onBlur={(e) => { if (e.target.value !== (sp.get(name) || '')) update({ [name]: e.target.value }) }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
  )

  return (
    <div className="mx-auto max-w-[1180px] px-4 md:px-6 py-8">
      {/* Title banner: light orange (one of the only two orange places in the store), straight on the white
          page, same width as the product grid; nothing behind it, so no blur */}
      <div className="mb-8 rounded-[20px] border border-[rgba(255,255,255,0.55)] bg-[rgba(255,106,26,0.30)] p-5 text-[#111111] shadow-[0_10px_30px_rgba(17,17,17,0.10)] md:p-7">
        <h1 className="text-2xl font-bold tracking-tight md:text-4xl">{heading}</h1>
        <p className="mt-1 text-sm text-[#111111]/80">{loading ? '…' : `${result.total} ${t('results')}`}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm lg:hidden">
          <SlidersHorizontal size={16} /> {t('filters')}
        </button>
        {chips.map((c) => (
          <button key={c.key} onClick={() => update({ [c.key]: '' })}
            className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100">
            {c.label} <X size={14} />
          </button>
        ))}
        <select value={sp.get('sort') || 'newest'}
          onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}
          aria-label={t('sortBy')} className="ms-auto rounded-full border bg-white px-4 py-2 text-sm outline-none">
          {SORTS.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
        </select>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} h-fit space-y-6 rounded-3xl border bg-white p-5 lg:sticky lg:top-24 lg:block`}>
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
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sp.get('onSale') === 'true'}
                onChange={(e) => update({ onSale: e.target.checked ? 'true' : '' })} />
              {t('onlySale')}
            </label>
            <label className="flex items-center gap-2">
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
                className="rounded-full border px-4 py-2 disabled:opacity-40">{t('prev')}</button>
              <span>{page} / {result.pages}</span>
              <button disabled={page >= result.pages} onClick={() => update({ page: page + 1 })}
                className="rounded-full border px-4 py-2 disabled:opacity-40">{t('next')}</button>
            </div>
          )}

          {!loading && result.items.length < 4 && <Suggestions />}
        </div>
      </div>
    </div>
  )
}