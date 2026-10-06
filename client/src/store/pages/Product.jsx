import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, ShoppingBag, Zap } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { track } from '../../lib/pixel'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import QtyStepper from '../components/QtyStepper'
import OrderForm from '../components/OrderForm'
import ProductGrid from '../components/ProductGrid'

function ProductView({ product, related }) {
  const { t, pick, money, settings } = useStore()
  const { add, setOpen } = useCart()
  const variants = product.variants || []
  const images = product.images || []

  const [img, setImg] = useState(0)
  const [variantName, setVariantName] = useState(
    () => variants.find((v) => v.stock > 0)?.name || variants[0]?.name || ''
  )
  const [qty, setQty] = useState(1)
  const [showForm, setShowForm] = useState(false)

  const variant = variants.find((v) => v.name === variantName)
  const unitPrice = variant?.price || product.price
  const stock = variants.length ? variant?.stock ?? 0 : product.stock
  const out = stock <= 0
  const maxQty = Math.max(1, Math.min(20, stock))
  const safeQty = Math.min(qty, maxQty)
  const off = product.compareAtPrice > unitPrice ? Math.round((1 - unitPrice / product.compareAtPrice) * 100) : 0

  const lineItem = {
    productId: product._id,
    slug: product.slug,
    name: product.name,
    image: images[0]?.url,
    price: unitPrice,
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
      content_type: 'product', value: unitPrice * safeQty, currency: 'QAR',
    })
    setOpen(true)
  }

  const waHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
        `${t('whatsappAsk')} ${pick(product.name)} ${window.location.href}`
      )}`
    : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div>
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

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold">{money(unitPrice)}</span>
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

          {!out && (
            <div className="mt-5 flex items-center gap-4">
              <span className="text-sm font-medium">{t('quantity')}</span>
              <QtyStepper value={safeQty} onChange={setQty} max={maxQty} />
            </div>
          )}

          <div className="mt-6 grid gap-3">
            <button onClick={addToCart} disabled={out}
              className="flex items-center justify-center gap-2 rounded-full bg-gray-900 py-3.5 font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50">
              <ShoppingBag size={20} /> {t('addToCart')}
            </button>
            <button onClick={() => setShowForm(!showForm)} disabled={out}
              className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
              <Zap size={20} /> {t('orderNow')}
            </button>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-full border-2 border-green-500 py-3 font-semibold text-green-600 transition hover:bg-green-50">
                <MessageCircle size={20} /> {t('askWhatsapp')}
              </a>
            )}
          </div>

          <AnimatePresence>
            {showForm && !out && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
                  <h3 className="mb-4 font-bold">{t('orderDetails')}</h3>
                  <OrderForm lines={[{ ...lineItem, qty: safeQty }]} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {pick(product.description) && (
            <div className="mt-8">
              <h3 className="mb-2 font-semibold">{t('description')}</h3>
              <p className="whitespace-pre-line text-gray-600">{pick(product.description)}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold">{t('related')}</h2>
          <ProductGrid items={related} loading={false} />
        </section>
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