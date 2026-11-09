
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Banknote, ShoppingBag, Truck, Zap } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { track } from '../../lib/pixel'
import { repriceCart } from '../../lib/pricing'
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
import ProductGallery from '../components/ProductGallery'
import VariantPicker from '../components/VariantPicker'
import NotifyMe from '../components/NotifyMe'
import TrustInfo from '../components/TrustInfo'
import { TRUST_KEYS } from '../components/trustKeys'
import { Stars } from '../components/Stars'
import { WhatsAppIcon } from '../components/icons'

const r2 = (n) => Math.round(n * 100) / 100

function countBy(list) {
  const out = {}

  for (const x of list) {
    out[x] = (out[x] || 0) + 1
  }

  return out
}

// One option per unit, never more than the stock of an option
function fit(variants, current, n) {
  const next = current.slice(0, n)
  const used = {}

  next.forEach((name) => {
    used[name] = (used[name] || 0) + 1
  })

  const free = (v) => (Number(v.stock) || 0) - (used[v.name] || 0)

  while (next.length < n) {
    const last = variants.find((v) => v.name === next[next.length - 1])

    const variant =
      last && free(last) > 0
        ? last
        : variants.find((v) => free(v) > 0) || variants[0]

    if (!variant) break

    next.push(variant.name)
    used[variant.name] = (used[variant.name] || 0) + 1
  }

  return next
}

function ProductView({ product, related = [] }) {
  const { t, lang, pick, money, settings } = useStore()
  const { addMany, setOpen } = useCart()
  const [sp] = useSearchParams()

  const variants = product.variants || []
  const images = product.images || []
  const packs = (product.packs || []).map(({ qty, price }) => ({
    qty,
    price,
  }))
  const packOffers = product.packs || [] // with badges, only for display
  const formRef = useRef(null)

  // Description pictures
  const sets = product.descriptionImages || {}
  const ownSet = sets[lang] || []
  const otherSet = sets[lang === 'ar' ? 'en' : 'ar'] || []
  const descImages = ownSet.length ? ownSet : otherSet

  const firstInStock =
    variants.find((v) => Number(v.stock) > 0)?.name ||
    variants[0]?.name ||
    ''

  const totalStock = variants.length
    ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
    : Number(product.stock) || 0

  // Initial pack quantity
  const wanted =
    Number(sp.get('pack')) ||
    Number(product.defaultQty) ||
    1

  const startQty =
    wanted > 1 && packs.some((p) => Number(p.qty) === wanted)
      ? Math.min(wanted, 20, Math.max(1, totalStock))
      : 1

  const [qty, setQty] = useState(startQty)
  const [picks, setPicks] = useState(() =>
    variants.length ? fit(variants, [], startQty) : []
  )
  const [focus, setFocus] = useState(null)
  const [notifyFor, setNotifyFor] = useState(null)

  const out = totalStock <= 0
  const maxQty = Math.max(1, Math.min(20, totalStock))
  const safeQty = Math.min(qty, maxQty)

  // One option per unit
  const unitPicks = variants.length
    ? Array.from(
        { length: safeQty },
        (_, i) => picks[i] || firstInStock
      )
    : []

  // Display selected variant image
  function showVariantPicture(name) {
    const variant = variants.find((item) => item.name === name)

    if (
      variant &&
      typeof variant.image === 'string' &&
      variant.image.trim() !== ''
    ) {
      setFocus({
        url: variant.image,
        n: Date.now(),
      })
    } else {
      setFocus(null)
    }
  }

  function changeQty(n) {
    const newQty = Math.max(1, Math.min(Number(n) || 1, maxQty))

    setQty(newQty)

    if (variants.length) {
      setPicks((current) => fit(variants, current, newQty))
    }
  }

  function pickVariant(i, name) {
    setNotifyFor(null)

    setPicks((current) => {
      const next = [...current]
      next[i] = name
      return next
    })

    showVariantPicture(name)
  }

  function sameForAll(name) {
    setPicks(unitPicks.map(() => name))
    showVariantPicture(name)
    setNotifyFor(null)
  }

  // Products being purchased
  const lines = variants.length
    ? Object.entries(countBy(unitPicks)).map(([name, n]) => {
        const variant = variants.find((v) => v.name === name)
        const ownPrice = variant ? Number(variant.price) || 0 : 0
        const basePrice = ownPrice || Number(product.price) || 0

        return {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          image: variant?.image || images[0]?.url,
          variantName: name,
          qty: n,
          base: basePrice,
          price: basePrice,
          packs: ownPrice ? [] : packs,
          poolable: !ownPrice,
          gift: product.gift || null,
        }
      })
    : [
        {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          image: images[0]?.url,
          qty: safeQty,
          base: product.price,
          price: product.price,
          packs,
          poolable: true,
          gift: product.gift || null,
        },
      ]

  const priced = repriceCart(lines)

  const total = r2(
    priced.reduce((sum, line) => sum + line.price * line.qty, 0)
  )

  const fullTotal = r2(
    priced.reduce((sum, line) => sum + line.base * line.qty, 0)
  )

  const saved = r2(fullTotal - total)

  const gifts = priced.reduce(
    (sum, line) => sum + (line.giftQty || 0),
    0
  )

  const firstVariant = variants.find(
    (v) => v.name === unitPicks[0]
  )

  const displayBase =
    firstVariant?.price || product.price

  const off =
    product.compareAtPrice > displayBase
      ? Math.round(
          (1 - displayBase / product.compareAtPrice) * 100
        )
      : 0

  // Product gallery images plus variant images
  const extra = [
    ...new Set(
      variants.map((v) => v.image).filter(Boolean)
    ),
  ].filter(
    (url) => !images.some((image) => image.url === url)
  )

  const galleryImages = [
    ...images,
    ...extra.map((url) => ({ url })),
  ]

  const hasTrust = TRUST_KEYS.some((key) =>
    pick(settings.trust?.[key])
  )

  // Facebook Pixel: ViewContent
  useEffect(() => {
    track('ViewContent', {
      content_ids: [product._id],
      content_name: product.name?.en || '',
      content_type: 'product',
      value: product.price,
      currency: 'QAR',
    })
  }, [product._id, product.name, product.price])

  // Browser title
  useEffect(() => {
    const store = settings.storeName || 'Nextova'

    document.title = `${pick(product.name)} | ${store}`

    return () => {
      document.title = store
    }
  }, [product, pick, settings.storeName])

  function addToCart() {
    addMany(priced)

    track('AddToCart', {
      content_ids: [product._id],
      content_name: product.name?.en || '',
      content_type: 'product',
      value: total,
      currency: 'QAR',
    })

    setOpen(true)
  }

  function goToForm() {
    formRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const waHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
        `${t('whatsappAsk')} ${pick(product.name)} ${window.location.href}`
      )}`
    : null

  return (
    <div>
      {/* Main section */}
      <div className="mx-auto max-w-7xl px-4 pt-8">
        <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
          {/* Product gallery */}
          <div className="md:sticky md:top-28 md:self-start">
            <ProductGallery
              images={galleryImages}
              alt={pick(product.name)}
              focus={focus}
              badge={
                off > 0 ? (
                  <span className="absolute start-3 top-3 z-10 rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
                    {off}% {t('off')}
                  </span>
                ) : null
              }
            />
          </div>

          {/* Product information */}
          <div>
            {product.category && (
              <Link
                to={`/shop?category=${product.category.slug}`}
                className="text-sm text-emerald-600 hover:underline"
              >
                {pick(product.category.name)}
              </Link>
            )}

            <h1 className="mt-1 text-2xl font-bold md:text-3xl">
              {pick(product.name)}
            </h1>

            {product.ratingCount > 0 && (
              <a
                href="#reviews"
                className="mt-2 flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600"
              >
                <Stars value={product.ratingAvg} size={18} />
                <span>
                  {product.ratingAvg} · {product.ratingCount}{' '}
                  {t('reviewsCount')}
                </span>
              </a>
            )}

            {product.soldCount >= 10 && (
              <div className="mt-2 text-sm font-semibold text-orange-600">
                🔥 {t('soldCount').replace('{n}', product.soldCount)}
              </div>
            )}

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold">
                {money(displayBase)}
              </span>

              {off > 0 && (
                <s className="text-lg text-gray-400">
                  {money(product.compareAtPrice)}
                </s>
              )}
            </div>

            <p
              className={`mt-2 text-sm font-medium ${
                out ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {out
                ? t('outOfStock')
                : totalStock <= 5
                  ? t('lowStockNote')
                  : t('inStockLabel')}
            </p>

                        {!out && <PackOffers base={product.price} packs={packOffers} qty={safeQty} max={maxQty} onPick={changeQty} />}

            {/* Variant selection */}
            {variants.length > 0 && !out && (
              <VariantPicker
                variants={variants}
                picks={unitPicks}
                onPick={pickVariant}
                onSame={sameForAll}
                onSoldOut={setNotifyFor}
              />
            )}

            {/* Sold-out notifications */}
            {out && (
              <NotifyMe
                key="all"
                productId={product._id}
              />
            )}

            {!out && notifyFor && (
              <NotifyMe
                key={notifyFor}
                productId={product._id}
                variantName={notifyFor}
              />
            )}

            {/* Free gift */}
            {product.gift && !out && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 p-4">
                {product.gift.image && (
                  <img
                    src={optimizeImg(product.gift.image, 120)}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                )}

                <div className="text-sm">
                  <div className="font-bold text-emerald-800">
                    🎁 {t('freeGift')}
                  </div>

                  <div className="text-emerald-900">
                    {t('giftLine')
                      .replace('{n}', product.gift.minQty)
                      .replace(
                        '{gift}',
                        `${
                          product.gift.qty > 1
                            ? `${product.gift.qty} × `
                            : ''
                        }${pick(product.gift.name)}`
                      )}
                  </div>

                  {gifts > 0 && (
                    <div className="mt-1 text-xs font-semibold text-emerald-700">
                      ✓ {t('giftIncluded')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quantity */}
            {!out && (
              <div className="mt-5 flex items-center gap-4">
                <span className="text-sm font-medium">
                  {t('quantity')}
                </span>

                <QtyStepper
                  value={safeQty}
                  onChange={changeQty}
                  max={maxQty}
                />
              </div>
            )}

            {/* Total */}
            {!out && (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-600">
                  {t('total')}
                </span>

                <span className="text-end">
                  <span className="text-xl font-extrabold">
                    {money(total)}
                  </span>

                  {saved > 0 && (
                    <span className="block text-xs font-semibold text-green-600">
                      {t('youSave').replace('{amt}', money(saved))}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 grid gap-3">
              <button
                onClick={addToCart}
                disabled={out}
                className="flex items-center justify-center gap-2 rounded-full bg-gray-900 py-3.5 font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
              >
                <ShoppingBag size={20} />
                {t('addToCart')}
              </button>

              <button
                onClick={goToForm}
                disabled={out}
                className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <Zap size={20} />
                {t('orderNow')}
              </button>

              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 font-semibold text-white transition hover:brightness-110"
                >
                  <WhatsAppIcon size={22} />
                  {t('askWhatsapp')}
                </a>
              )}
            </div>

            {/* Trust information */}
            {hasTrust ? (
              <TrustInfo />
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-600">
                <div className="rounded-2xl bg-gray-50 p-3">
                  <Banknote size={20} className="mx-auto mb-1 text-emerald-600" />
                  {t('codTitle')}
                </div>

                <div className="rounded-2xl bg-gray-50 p-3">
                  <Truck size={20} className="mx-auto mb-1 text-emerald-600" />
                  {t('fastTitle')}
                </div>

                <div className="rounded-2xl bg-gray-50 p-3">
                  <WhatsAppIcon size={20} className="mx-auto mb-1 text-emerald-600" />
                  {t('supportTitle')}
                </div>
              </div>
            )}

            {/* Order form */}
            {!out && (
              <div
                ref={formRef}
                className="mt-5 scroll-mt-28 rounded-3xl border bg-white p-5 shadow-sm"
              >
                <h3 className="mb-4 font-bold">
                  {t('orderDetails')}
                </h3>

                <OrderForm lines={priced} />
              </div>
            )}

            {/* Text description */}
            {descImages.length === 0 && pick(product.description) && (
              <div className="mt-8">
                <h3 className="mb-2 font-semibold">
                  {t('description')}
                </h3>

                <p className="whitespace-pre-line text-gray-600">
                  {pick(product.description)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Optional product video */}
      <ProductVideo video={product.video} />

      {/* Description pictures */}
      {descImages.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 px-4 text-center text-2xl font-bold">
            {t('description')}
          </h2>

          <div>
            {descImages.map((im, i) => (
              <img
                key={im.url || i}
                src={optimizeImg(im.url, 1920)}
                alt={`${pick(product.name)} ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="block w-full"
              />
            ))}
          </div>
        </section>
      )}

      {/* Additional product information */}
      <div className="mx-auto max-w-7xl px-4 pb-28 md:pb-8">
        <ProductCompare rows={product.comparison} />

        <Reviews productId={product._id} />

        <ProductFaq faqs={product.faqs} />

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold">
              {t('related')}
            </h2>

            <ProductGrid
              items={related}
              loading={false}
            />
          </section>
        )}
      </div>

      {/* Sticky order bar on phones */}
      {!out && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="leading-tight">
            <div className="text-xs text-gray-500">
              {t('total')}
            </div>

            <div className="text-lg font-extrabold">
              {money(total)}
            </div>
          </div>

          <button
            onClick={goToForm}
            className="flex-1 rounded-full bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500"
          >
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

  const [state, setState] = useState({
    slug: null,
    product: null,
    related: [],
    missing: false,
  })

  useEffect(() => {
    let cancelled = false

    api(`/products/${slug}`)
      .then((data) => {
        if (!cancelled) {
          // Preserve the original API response structure
          setState({
            slug,
            ...data,
            missing: false,
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            slug,
            product: null,
            related: [],
            missing: true,
          })
        }
      })

    return () => {
      cancelled = true
    }
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

  if (state.missing || !state.product) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="mb-4 text-lg text-gray-600">
          {t('notFound')}
        </p>

        <Link
          to="/shop"
          className="rounded-full bg-gray-900 px-6 py-2.5 text-white hover:bg-emerald-600"
        >
          {t('backToShop')}
        </Link>
      </div>
    )
  }

  return (
    <ProductView
      key={state.product._id}
      product={state.product}
      related={state.related || []}
    />
  )
}
