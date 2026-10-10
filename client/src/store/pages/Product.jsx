import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Banknote, ShoppingBag, Truck, Zap } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { track } from '../../lib/pixel'
import { bestTotal, giftCount } from '../../lib/pricing'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import QtyStepper from '../components/QtyStepper'
import OrderForm from '../components/OrderForm'
import ProductGrid from '../components/ProductGrid'
import Reviews from '../components/Reviews'
import PackOffers from '../components/PackOffers'
import ProductCompare from '../components/ProductCompare'
import ProductFaq from '../components/ProductFaq'
import ProductVideo from '../components/ProductVideo'
import { Stars } from '../components/Stars'
import { WhatsAppIcon } from '../components/icons'

function ProductView({ product, related }) {
  const { t, lang, pick, money, settings } = useStore()
  const { add, setOpen } = useCart()
  const variants = product.variants || []
  const images = product.images || []
  const formRef = useRef(null)

  // description pictures: the set for the visitor's language, or the other set if that one is empty
  const sets = product.descriptionImages || {}
  const ownSet = sets[lang] || []
  const otherSet = sets[lang === 'ar' ? 'en' : 'ar'] || []
  const descImages = ownSet.length ? ownSet : otherSet

  const [img, setImg] = useState(0)
  const [variantName, setVariantName] = useState(
    () => variants.find((v) => v.stock > 0)?.name || variants[0]?.name || ''
  )
  const [qty, setQty] = useState(1)

  const variant = variants.find((v) => v.name === variantName)
  const base = variant?.price || product.price
  const packs = variant?.price ? [] : product.packs || [] // pack offers apply to the normal price only
  const stock = variants.length ? variant?.stock ?? 0 : product.stock
  const out = stock <= 0
  const maxQty = Math.max(1, Math.min(20, stock))
  const safeQty = Math.min(qty, maxQty)

  const total = bestTotal(safeQty, base, packs)
  const unit = total / safeQty
  const saved = Math.round((base * safeQty - total) * 100) / 100
  const off = product.compareAtPrice > base ? Math.round((1 - base / product.compareAtPrice) * 100) : 0
  const gifts = giftCount({ gift: product.gift, qty: safeQty })

  const lineItem = {
    productId: product._id,
    slug: product.slug,
    name: product.name,
    image: images[0]?.url,
    base,
    packs: packs.map(({ qty: q, price }) => ({ qty: q, price })),
    gift: product.gift || null,
    price: unit,
    variantName: variant?.name,
  }

  useEffect(() => {
    track('ViewContent', {
      content_ids: [product._id], content_name: product.name.en,
      content_type: 'product', value: product.price, currency: 'QAR',
    })
  }, [product._id, product.name.en, product.price])

  useEffect(() => {
    const store = settings.storeName || 'Nextova'
    document.title = `${pick(product.name)} | ${store}`
    return () => { document.title = store }
  }, [product, pick, settings.storeName])

  function addToCart() {
    add(lineItem, safeQty)
    track('AddToCart', {
      content_ids: [product._id], content_name: product.name.en,
      content_type: 'product', value: total, currency: 'QAR',
    })
    setOpen(true)
  }

  function goToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const waHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
        `${t('whatsappAsk')} ${pick(product.name)} ${window.location.href}`
      )}`
    : null

  return (
    <div>
      {/* main section: gallery + buying */}
      <div className="mx-auto max-w-7xl px-4 pt-8">
        <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-gray-100">
              {images.length > 0 && (
                <AnimatePresence mode="wait">
                  <motion.img key={img} src={optimizeImg(images[img]?.url, 900)} alt={pick(product.name)}
                    initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }} className="h-full w-full object-cover" />
                </AnimatePresence>
              )}
              {off > 0 && (
                <span className="absolute start-3 top-3 rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
                  {off}% {t('off')}
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((im, i) => (
                  <button key={im.url} onClick={() => setImg(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      i === img ? 'border-emerald-500' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}>
                    <img src={optimizeImg(im.url, 120)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.category && (
              <Link to={`/shop?category=${product.category.slug}`} className="text-sm text-emerald-600 hover:underline">
                {pick(product.category.name)}
              </Link>
            )}
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">{pick(product.name)}</h1>

            {product.ratingCount > 0 && (
              <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600">
                <Stars value={product.ratingAvg} size={18} />
                <span>{product.ratingAvg} · {product.ratingCount} {t('reviewsCount')}</span>
              </a>
            )}

            {product.soldCount >= 10 && (
              <div className="mt-2 text-sm font-semibold text-orange-600">
                🔥 {t('soldCount').replace('{n}', product.soldCount)}
              </div>
            )}

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold">{money(base)}</span>
              {off > 0 && <s className="text-lg text-gray-400">{money(product.compareAtPrice)}</s>}
            </div>

            <p className={`mt-2 text-sm font-medium ${out ? 'text-red-600' : 'text-emerald-600'}`}>
              {out ? t('outOfStock') : stock <= 5 ? t('lowStockNote') : t('inStockLabel')}
            </p>

            {variants.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-sm font-medium">{t('option')}</div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button key={v.name} onClick={() => { setVariantName(v.name); setQty(1) }} disabled={v.stock <= 0}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        v.name === variantName ? 'border-gray-900 bg-gray-900 text-white' : 'hover:border-gray-900'
                      } disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through`}>
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!out && <PackOffers base={base} packs={packs} qty={safeQty} max={maxQty} onPick={setQty} />}

            {product.gift && !out && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 p-4">
                {product.gift.image && (
                  <img src={optimizeImg(product.gift.image, 120)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                )}
                <div className="text-sm">
                  <div className="font-bold text-emerald-800">🎁 {t('freeGift')}</div>
                  <div className="text-emerald-900">
                    {t('giftLine')
                      .replace('{n}', product.gift.minQty)
                      .replace('{gift}', `${product.gift.qty > 1 ? `${product.gift.qty} × ` : ''}${pick(product.gift.name)}`)}
                  </div>
                  {gifts > 0 && <div className="mt-1 text-xs font-semibold text-emerald-700">✓ {t('giftIncluded')}</div>}
                </div>
              </div>
            )}

            {!out && (
              <div className="mt-5 flex items-center gap-4">
                <span className="text-sm font-medium">{t('quantity')}</span>
                <QtyStepper value={safeQty} onChange={setQty} max={maxQty} />
              </div>
            )}

            {!out && (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-600">{t('total')}</span>
                <span className="text-end">
                  <span className="text-xl font-extrabold">{money(total)}</span>
                  {saved > 0 && (
                    <span className="block text-xs font-semibold text-green-600">{t('youSave').replace('{amt}', money(saved))}</span>
                  )}
                </span>
              </div>
            )}

            <div className="mt-6 grid gap-3">
              <button onClick={addToCart} disabled={out}
                className="flex items-center justify-center gap-2 rounded-full bg-gray-900 py-3.5 font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50">
                <ShoppingBag size={20} /> {t('addToCart')}
              </button>
              <button onClick={goToForm} disabled={out}
                className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
                <Zap size={20} /> {t('orderNow')}
              </button>
              {waHref && (
                <a href={waHref} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 font-semibold text-white transition hover:brightness-110">
                  <WhatsAppIcon size={22} /> {t('askWhatsapp')}
                </a>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-600">
              <div className="rounded-2xl bg-gray-50 p-3"><Banknote size={20} className="mx-auto mb-1 text-emerald-600" />{t('codTitle')}</div>
              <div className="rounded-2xl bg-gray-50 p-3"><Truck size={20} className="mx-auto mb-1 text-emerald-600" />{t('fastTitle')}</div>
              <div className="rounded-2xl bg-gray-50 p-3"><WhatsAppIcon size={20} className="mx-auto mb-1 text-emerald-600" />{t('supportTitle')}</div>
            </div>

            {/* the order form is always open: one less tap between "I want it" and "ordered" */}
            {!out && (
              <div ref={formRef} className="mt-5 scroll-mt-24 rounded-3xl border bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold">{t('orderDetails')}</h3>
                <OrderForm lines={[{ ...lineItem, qty: safeQty }]} />
              </div>
            )}

            {/* text description only when there are no description pictures */}
            {descImages.length === 0 && pick(product.description) && (
              <div className="mt-8">
                <h3 className="mb-2 font-semibold">{t('description')}</h3>
                <p className="whitespace-pre-line text-gray-600">{pick(product.description)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* optional vertical video (only products that have one) */}
      <ProductVideo video={product.video} />

      {/* description pictures: the full width of the page, one under the other */}
      {descImages.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 px-4 text-center text-2xl font-bold">{t('description')}</h2>
          <div>
            {descImages.map((im, i) => (
              <img key={im.url} src={optimizeImg(im.url, 1920)} alt={`${pick(product.name)} ${i + 1}`}
                loading="lazy" decoding="async" className="block w-full" />
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-28 md:pb-8">
        <ProductCompare rows={product.comparison} />
        <Reviews productId={product._id} />
        <ProductFaq faqs={product.faqs} />

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold">{t('related')}</h2>
            <ProductGrid items={related} loading={false} />
          </section>
        )}
      </div>

      {/* sticky order bar, phones only */}
      {!out && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="leading-tight">
            <div className="text-xs text-gray-500">{t('total')}</div>
            <div className="text-lg font-extrabold">{money(total)}</div>
          </div>
          <button onClick={goToForm}
            className="flex-1 rounded-full bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500">
            {t('orderShort')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Product() {
  const { slug } = useParams()
  const { t } = useStore()
  const [state, setState] = useState({ slug: null })

  useEffect(() => {
    let cancelled = false
    api(`/products/${slug}`)
      .then((d) => { if (!cancelled) setState({ slug, ...d }) })
      .catch(() => { if (!cancelled) setState({ slug, missing: true }) })
    return () => { cancelled = true }
  }, [slug])

  if (state.slug !== slug) {
    return (
      <div className="mx-auto grid max-w-7xl animate-pulse gap-8 px-4 py-8 md:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-gray-200" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 rounded bg-gray-200" />
          <div className="h-8 w-1/3 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  if (state.missing) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="mb-4 text-lg text-gray-600">{t('notFound')}</p>
        <Link to="/shop" className="rounded-full bg-gray-900 px-6 py-2.5 text-white hover:bg-emerald-600">{t('backToShop')}</Link>
      </div>
    )
  }

  return <ProductView key={state.product._id} product={state.product} related={state.related || []} />
}