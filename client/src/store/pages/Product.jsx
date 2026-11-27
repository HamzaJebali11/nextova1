
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Check, ShoppingBag, Zap } from 'lucide-react'
import { fetchOnce } from '../../lib/prefetch'
import { resolveAngle } from '../../lib/angle'
import { optimizeImg } from '../../lib/image'
import { track } from '../../lib/pixel'
import { packLabel, repriceCart } from '../../lib/pricing'
import { flyToCart } from '../../lib/flyToCart'
import { usePageMeta } from '../../lib/seo'
import { useStore } from '../storeContext'
import { useCart } from '../../cart/cartContext'
import QtyStepper from '../components/QtyStepper'
import OrderModal from '../components/OrderModal'
import Section, { SectionStack } from '../components/Section'
import { AlsoLikeRow, AllProductsGrid } from '../components/ProductLists'
import DeliveryEstimate from '../components/DeliveryEstimate'
import ProductAccordions from '../components/ProductAccordions'
import { Stars } from '../components/Stars'
import Reviews from '../components/Reviews'
import PackOffers from '../components/PackOffers'
import ProofBar from '../components/ProofBar'
import ProductCompare from '../components/ProductCompare'
import ProductFaq from '../components/ProductFaq'
import ProductGallery from '../components/ProductGallery'
import DescriptionStory from '../components/DescriptionStory'
import VariantPicker, { OptionPicker } from '../components/VariantPicker'
import { comboLabel, comboLabels, comboOf, compareAtOf, isOn, optionTypesOf, priceRange, unitPriceOf } from '../../lib/options'
import NotifyMe from '../components/NotifyMe'
import TrustInfo from '../components/TrustInfo'
import ShareButton from '../components/ShareButton'
import BestSellerChip from '../components/BestSellerChip'
import { liveProduct } from '../../lib/live'
import { WhatsAppIcon } from '../components/icons'

const r2 = (n) => Math.round(n * 100) / 100
// a new number each time a picture is asked for (the gallery shows it even if it is the same picture again)
let focusSeq = 0
const nextFocus = () => ++focusSeq

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

// products with option types: one list of chosen values per unit (null = not chosen yet).
// One type works like the older variants (the first one in stock is chosen); with two types the customer chooses.
function fitParts(product, types, current, n) {
  const next = current.slice(0, n)
  const nameOf = (vals) => comboOf(product, vals)?.name
  const used = {}
  next.forEach((vals) => { const k = nameOf(vals); if (k) used[k] = (used[k] || 0) + 1 })
  const free = (v) => (Number(v.stock) || 0) - (used[v.name] || 0)
  while (next.length < n) {
    const last = next[next.length - 1]
    const lastV = last && comboOf(product, last)
    let vals
    if (lastV && free(lastV) > 0) vals = [...last]
    else if (types.length === 1) {
      const v = (product.variants || []).find((x) => isOn(x) && free(x) > 0)
      vals = [v ? v.options?.[0]?.value || v.name : null]
    } else vals = types.map(() => null)
    next.push(vals)
    const k = nameOf(vals)
    if (k) used[k] = (used[k] || 0) + 1
  }
  return next
}

function ProductView({ product }) {
  const { t, lang, pick, money, settings, event } = useStore()
  const { addMany } = useCart()
  const [sp] = useSearchParams()

  const variants = product.variants || []
  // option types (Size, Color): each variant is one combination; empty for older products
  const types = optionTypesOf(product)
  const grouped = types.length > 0
  const range = priceRange(product)
  const images = product.images || []
  const packs = (product.packs || []).map(({ qty, price }) => ({
    qty,
    price,
  }))
  const packOffers = product.packs || [] // with badges, only for display

  // Description pictures
  const sets = product.descriptionImages || {}
  const ownSet = sets[lang] || []
  const otherSet = sets[lang === 'ar' ? 'en' : 'ar'] || []
  const descImages = ownSet.length ? ownSet : otherSet

  const firstInStock =
    variants.find((v) => Number(v.stock) > 0)?.name ||
    variants[0]?.name ||
    ''

  // (combinations that are switched off are not for sale)
  const totalStock = variants.length
    ? variants.filter((v) => !grouped || isOn(v)).reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
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
    variants.length && !grouped ? fit(variants, [], startQty) : []
  )
  const [parts, setParts] = useState(() => (grouped ? fitParts(product, types, [], startQty) : []))
  const [missing, setMissing] = useState(() => new Set()) // "unit:type" groups to highlight
  const groupEls = useRef({})
  const [focus, setFocus] = useState(null)
  const [notifyFor, setNotifyFor] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const closeForm = useCallback(() => setFormOpen(false), [])

  const out = totalStock <= 0
  const maxQty = Math.max(1, Math.min(20, totalStock))
  const safeQty = Math.min(qty, maxQty)

  // One option per unit
  const unitParts = grouped
    ? Array.from({ length: safeQty }, (_, i) => parts[i] || types.map(() => null))
    : []
  const unitPicks = grouped
    ? unitParts.map((vals) => comboOf(product, vals)?.name || '')
    : variants.length
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
        n: nextFocus(),
      })
    } else {
      setFocus(null)
    }
  }

  function changeQty(n) {
    const newQty = Math.max(1, Math.min(Number(n) || 1, maxQty))

    setQty(newQty)

    if (grouped) setParts((current) => fitParts(product, types, current, newQty))
    else if (variants.length) {
      setPicks((current) => fit(variants, current, newQty))
    }
  }

  // products with option types: choose (or clear) one value of one type for one unit
  function pickPart(i, ti, value) {
    setNotifyFor(null)
    const vals = [...unitParts[i]]
    vals[ti] = value
    setParts(unitParts.map((x, j) => (j === i ? vals : x)))
    setMissing((m) => { if (!m.has(`${i}:${ti}`)) return m; const n = new Set(m); n.delete(`${i}:${ti}`); return n })
    // the value's own picture, else the combination's picture (as the older variant pictures)
    const img = value && types[ti].values.find((x) => x.en === value)?.image
    const combo = comboOf(product, vals)
    if (img) setFocus({ url: img, n: nextFocus() })
    else if (combo?.image) showVariantPicture(combo.name)
  }

  function samePartsForAll(first) {
    setParts(unitParts.map(() => [...first]))
    setNotifyFor(null)
    setMissing(new Set())
  }

  // before Add to cart / Order now: every type chosen for every unit, else scroll to the first missing group
  function ensureChosen() {
    if (!grouped) return true
    const gaps = new Set()
    unitParts.forEach((vals, i) => vals.forEach((v, ti) => { if (!v) gaps.add(`${i}:${ti}`) }))
    if (!gaps.size) return true
    setMissing(gaps)
    const first = groupEls.current[[...gaps][0]]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    first?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    first?.querySelector('button')?.focus({ preventScroll: true })
    return false
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
        if (grouped && !name) {
          // not chosen yet: display only (Add to cart and Order now first ask for the choice)
          return {
            productId: product._id, slug: product.slug, name: product.name, image: images[0]?.url, variantName: '',
            qty: n, base: range.min, price: range.min, packs: [], poolable: false, gift: product.gift || null, incomplete: true,
          }
        }
        const variant = variants.find((v) => v.name === name)
        const ownPrice = variant ? Number(variant.price) || 0 : 0
        const basePrice = ownPrice || Number(product.price) || 0

        return {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          image: variant?.image || images[0]?.url,
          variantName: name,
          ...(grouped ? { variantLabel: comboLabels(product, name) } : {}),
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

  const gifts = priced.reduce(
    (sum, line) => sum + (line.giftQty || 0),
    0
  )

  const firstVariant = variants.find(
    (v) => v.name === unitPicks[0]
  )

  // products with option types: the chosen combination's own price and "was" price (else the product's)
  const choosing = grouped && unitPicks.some((n) => !n)
  const displayBase = grouped
    ? (firstVariant ? unitPriceOf(product, firstVariant) : range.min)
    : firstVariant?.price || product.price
  const compareAt = grouped ? (firstVariant ? compareAtOf(product, firstVariant) : 0) : product.compareAtPrice

  const off =
    compareAt > displayBase
      ? Math.round(
          (1 - displayBase / compareAt) * 100
        )
      : 0
  // pack cards: a combination with its own price is sold at that price for every quantity (no pack price),
  // exactly as the server charges it; otherwise the pack offers as they are
  const ownUnit = grouped && firstVariant && Number(firstVariant.price) > 0 ? Number(firstVariant.price) : 0
  const cardBase = ownUnit || product.price
  const cardPacks = ownUnit ? packOffers.map((x) => ({ qty: x.qty, price: r2(ownUnit * x.qty) })) : packOffers
  const fromText = t('fromPrice').replace('{amt}', money(range.min))
  const showFrom = choosing && range.min !== range.max

  // Product gallery images plus variant images
  const extra = [
    ...new Set(
      [...variants.map((v) => v.image), ...types.flatMap((ty) => ty.values.map((x) => x.image))].filter(Boolean)
    ),
  ].filter(
    (url) => !images.some((image) => image.url === url)
  )

  // Ad angle (?angle=slug or ?a=slug): only the title block and the first picture change
  const angle = useMemo(() => resolveAngle(product, sp.toString()), [product, sp])
  const angleBullets = angle
    ? ((angle.bullets?.[lang]?.length ? angle.bullets[lang] : angle.bullets?.en) || []).filter((b) => b && b.trim())
    : []

  const galleryImages = [
    ...(angle?.image ? [{ url: angle.image }] : []),
    ...images.filter((im) => im.url !== angle?.image),
    ...extra.map((url) => ({ url })),
  ]

  // Saving shown once, on the main picture (display only; no price is changed here)
  const hasPacks = packOffers.length > 0
  const oldUnit = compareAt > displayBase ? compareAt : displayBase
  const oldTotal = oldUnit * safeQty
  const savePct = oldTotal > 0 && total < oldTotal ? Math.round((1 - total / oldTotal) * 100) : 0

  // Short description: first paragraph of the description, trimmed
  const fullText = (pick(product.description) || '').trim()
  const firstPara = fullText.split(/\n/)[0].trim()
  const shortText =
    firstPara.length > 180
      ? `${firstPara.slice(0, 180).replace(/\s+\S*$/, '')}…`
      : firstPara
  // short benefit line under the title (its own field, or the first line of the description)
  const benefit = pick(product.benefit) || shortText
  const headline = (angle && pick(angle.headline)) || pick(product.name)
  const subline = (angle && pick(angle.subheadline)) || benefit

  // title, description and share picture; angle pages are variants of the same product page: noindex
  usePageMeta({
    title: `${pick(product.name)} | ${settings.storeName || 'Nextova'}`,
    description: shortText || pick(product.benefit),
    image: product.images?.[0]?.url ? optimizeImg(product.images[0].url, 1200) : undefined,
    robots: angle ? 'noindex' : undefined,
    type: 'product',
  })

  // the sticky order bar (all screen sizes) shows whenever the main Order now button is NOT on screen
  // The sticky Order now bar shows ONLY once the visitor has scrolled PAST the main Order now button: the button is
  // off screen AND above it (its bottom edge above the top of the screen). Before reaching the button, or while it
  // is (even partly) on screen, the bar is hidden. IntersectionObserver only (no scroll listener); its first answer
  // comes straight away, so a page that loads already scrolled (anchor, back button, reload) is right at once.
  const ctaRef = useRef(null)
  const [pastCta, setPastCta] = useState(false)
  useEffect(() => {
    const el = ctaRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      const top = entry.rootBounds ? entry.rootBounds.top : 0
      setPastCta(!entry.isIntersecting && entry.boundingClientRect.bottom <= top)
    }, { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [product._id])

  const barCanShow = !out
  useEffect(() => {
    if (!barCanShow) return
    const prev = document.body.style.paddingBottom
    document.body.style.paddingBottom = 'calc(84px + env(safe-area-inset-bottom))'
    return () => { document.body.style.paddingBottom = prev }
  }, [barCanShow])

  // live visitors: which product this visitor is looking at (anonymous heartbeat, lib/live.js)
  useEffect(() => {
    liveProduct(product._id)
    return () => liveProduct(null)
  }, [product._id])

  // Facebook Pixel: ViewContent
  useEffect(() => {
    track('ViewContent', {
      content_ids: [product._id],
      content_name: product.name?.en || '',
      content_type: 'product',
      value: grouped ? range.min : product.price, // option types: the lowest price until one is chosen
      currency: 'QAR',
    })
  }, [product._id, product.name, product.price, grouped, range.min])


  function addToCart(e) {
    if (!ensureChosen()) return
    const lines = priced
    const button = e?.currentTarget

    // Fly from the picture on screen; if it is scrolled away, from the button
    const shown = document.querySelector('[data-gallery-active="true"] img')
    const rect = shown?.getBoundingClientRect()
    const visible = rect && rect.bottom > 0 && rect.top < window.innerHeight
    const src = visible ? shown.currentSrc || shown.src : optimizeImg(lines[0]?.image, 300)
    const from = visible ? rect : button?.getBoundingClientRect()

    // The count updates when the picture lands; the cart stays closed
    flyToCart({ src, from, onLand: () => addMany(lines) })

    track('AddToCart', {
      content_ids: [product._id],
      content_name: product.name?.en || '',
      content_type: 'product',
      value: total,
      currency: 'QAR',
    })
  }

  // rating link: smooth scroll to the reviews (scroll-margin leaves room for the header), then focus their heading
  const reviewsHeading = useRef(null)
  function goToReviews() {
    const h = reviewsHeading.current
    const section = document.getElementById('reviews')
    if (!section) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setTimeout(() => h?.focus({ preventScroll: true }), reduce ? 0 : 450)
  }

  // InitiateCheckout once per product page view (closing and re-opening the form does not count again)
  const checkoutTracked = useRef(null)
  function openForm() {
    if (out) return
    if (!ensureChosen()) return
    setFormOpen(true)

    if (checkoutTracked.current === product._id) return
    checkoutTracked.current = product._id
    track('InitiateCheckout', {
      content_ids: [product._id],
      content_type: 'product',
      value: total,
      num_items: priced.reduce((n, line) => n + line.qty, 0),
      currency: 'QAR',
    })
  }

  const waHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
        `${t('whatsappAsk')} ${pick(product.name)} ${window.location.href}`
      )}`
    : null

  const benefits = angleBullets.slice(0, 3)
  const textDescription = descImages.length === 0 ? pick(product.description) : ''
  const about = pick(product.benefit) || shortText
  // stock bar: only when the REAL stock is at or below the admin number (default 15)
  const stockMax = Number(settings.stockBarMax) || 15
  const showStockBar = !out && totalStock <= stockMax

  return (
    <div className="nx-page pb-10 pt-4 md:pt-8">
      {/* top: gallery (left) + buy box (right) on wide screens; stacked on phones */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[minmax(0,1fr)_clamp(420px,32vw,560px)] lg:gap-16">
        <ProductGallery
          images={galleryImages}
          video={product.video}
          videoPosition={product.videoPosition}
          alt={pick(product.name)}
          focus={focus}
          badge={
            savePct > 0 || event ? (
              <div className="absolute start-3 top-3 z-[var(--z-content)] flex max-w-[70%] flex-wrap gap-2">
                {savePct > 0 && (
                  <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white" aria-live="polite">
                    {t('youSave').replace('{amt}', `${savePct}%`)}
                  </span>
                )}
                {/* sales event label: display only, the price is the product's own price */}
                {event && (
                  <span className="truncate rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-e1">
                    {pick(event.name)}
                  </span>
                )}
              </div>
            ) : null
          }
        />

        {/* Buy box: glass card (radius 24, sheen), no inner scroll, not sticky. Groups 24px apart, 8px inside a group. */}
        <div className="glass glass-sheen flex min-w-0 flex-col gap-6 self-start rounded-[24px] p-4 md:p-6">
          {/* 1. heading + secondary info */}
          <div className="flex flex-col gap-2">
            <nav aria-label={t('breadcrumb')} className="truncate text-xs text-gray-500">
              <Link to="/shop" className="tap-44 transition duration-150 hover:text-ink hover:underline">{t('shop')}</Link>
              {product.category && (
                <>{' / '}<Link to={`/shop?category=${product.category.slug}`} className="tap-44 transition duration-150 hover:text-ink hover:underline">{pick(product.category.name)}</Link></>
              )}
              {' / '}<span aria-current="page">{pick(product.name)}</span>
            </nav>

            <span className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold ${
                out ? 'bg-gray-200 text-gray-800' : 'bg-accent text-white'
              }`}>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                {out ? t('outOfStock') : t('inStockLabel')}
              </span>
              {product.isBestSeller && <BestSellerChip />}
            </span>

            <h1 className="font-display text-[24px] font-bold leading-tight md:text-[28px]">{headline}</h1>
            {subline && <p className="text-sm text-gray-600">{subline}</p>}

            {/* rating (tap: scroll to the reviews) */}
            {product.ratingCount > 0 && (
              <button type="button" onClick={goToReviews}
                className="flex min-h-11 items-center gap-1.5 self-start rounded-full text-sm text-ink transition duration-150">
                <Stars value={product.ratingAvg} size={16} />
                <span className="font-semibold text-ink">{Number(product.ratingAvg).toFixed(1)}</span>
                <span className="underline-offset-2 hover:underline">({t('reviewsN').replace('{n}', product.ratingCount)})</span>
              </button>
            )}

            {/* ad angle: up to 3 short benefits */}
            {benefits.length > 0 && (
              <ul className="space-y-1 text-sm">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{b}</li>
                ))}
              </ul>
            )}

            {/* social proof (real data only) */}
            <ProofBar slug={product.slug} />

            {/* delivery estimate (real Qatar-time countdown to the admin cut-off) */}
            {!out && <DeliveryEstimate />}
          </div>

          {/* 2. the offer: price or packs, options per item, notify, free gift */}
          <div className="flex flex-col gap-4 empty:hidden">
            {/* price line only when there are no packs (with packs, prices show only in the pack cards) */}
            {!hasPacks && (
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-[32px] font-extrabold leading-none">{showFrom ? fromText : money(displayBase)}</span>
                {off > 0 && !showFrom && <s className="text-gray-500">{money(compareAt)}</s>}
              </div>
            )}
            {/* the chosen combination, e.g. "100 ml / Black" (with packs and nothing chosen: the from-price) */}
            {grouped && !out && (firstVariant || (hasPacks && showFrom)) && (
              <p className="-mt-2 text-sm text-gray-600" aria-live="polite">
                {firstVariant ? t('optionChosen').replace('{v}', comboLabel(product, firstVariant.name, lang)) : fromText}
              </p>
            )}

            {!out && (
              <PackOffers base={grouped ? cardBase : product.price} compareAt={grouped ? compareAt : product.compareAtPrice}
                packs={grouped ? cardPacks : packOffers}
                qty={safeQty} max={maxQty} onPick={changeQty} />
            )}

            {/* option for each item */}
            {grouped && !out && (
              <OptionPicker product={product} types={types} parts={unitParts} onPart={pickPart} onSame={samePartsForAll}
                onSoldOut={setNotifyFor} missing={missing} groupRef={(i, ti, el) => { groupEls.current[`${i}:${ti}`] = el }} />
            )}
            {variants.length > 0 && !grouped && !out && (
              <VariantPicker variants={variants} picks={unitPicks} onPick={pickVariant} onSame={sameForAll} onSoldOut={setNotifyFor} />
            )}

            {/* sold-out notifications */}
            {out && <NotifyMe key="all" productId={product._id} />}
            {!out && notifyFor && <NotifyMe key={notifyFor} productId={product._id} variantName={notifyFor} />}

            {/* free gift */}
            {product.gift && !out && (
              <div className="glass flex items-center gap-3 rounded-2xl p-4">
                {product.gift.image && (
                  <img src={optimizeImg(product.gift.image, 120)} alt="" loading="lazy" width={56} height={56}
                    className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                )}
                <div className="text-sm">
                  <div className="font-bold text-ink">🎁 {t('freeGift')}</div>
                  <div className="text-ink">
                    {t('giftLine')
                      .replace('{n}', product.gift.minQty)
                      .replace('{gift}', `${product.gift.qty > 1 ? `${product.gift.qty} × ` : ''}${pick(product.gift.name)}`)}
                  </div>
                  {gifts > 0 && <div className="mt-1 text-xs font-semibold text-ink">✓ {t('giftIncluded')}</div>}
                </div>
              </div>
            )}
          </div>

          {/* 3. actions */}
          <div className="flex flex-col gap-2">
            {/* quantity + Add to cart: with packs, the packs ARE the quantity (no separate selector) */}
            {!out && (
              <div className="flex items-center gap-2">
                {!hasPacks && <QtyStepper value={safeQty} onChange={changeQty} max={maxQty} />}
                <button onClick={addToCart}
                  className="glass-btn min-h-12 flex-1 px-4 text-[15px]">
                  <ShoppingBag size={19} /> {t('addToCart')}
                </button>
              </div>
            )}

            {/* main Order now button: the biggest thing in the buy box */}
            <button ref={ctaRef} onClick={openForm} disabled={out}
              className="btn-primary-glass min-h-14 w-full px-4 py-4 text-[17px]">
              <Zap size={20} aria-hidden="true" />
              {out ? t('outOfStock') : `${t('orderShort')} · ${showFrom ? fromText : money(total)}`}
            </button>

            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer"
                className="glass-btn text-sm">
                <WhatsAppIcon size={18} /> {t('askWhatsapp')}
              </a>
            )}

            {/* stock bar: only when the real stock is low */}
            {showStockBar && (
              <div className="pt-2">
                <span className="text-xs font-medium text-gray-600">{t('onlyLeftStock').replace('{n}', totalStock)}</span>
                <div className="mt-2 h-1.5 rounded-full bg-gray-200" role="presentation">
                  <div className="h-1.5 rounded-full bg-ink" style={{ width: `${Math.max(4, Math.min(100, (totalStock / stockMax) * 100))}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* 4. trust row  5. accordions */}
          <TrustInfo />
          <ShareButton product={product} />
          <ProductAccordions product={product} about={about} />
        </div>
      </div>

      {/* below: full width, each its own rounded container (the video now lives in the gallery) */}
      <SectionStack className="mt-12 flex flex-col gap-6 md:mt-16 md:gap-8">
        {descImages.length > 0 && (
          <Section title={t('description')}>
            <DescriptionStory images={descImages} alt={pick(product.name)} />
          </Section>
        )}
        {textDescription && (
          <Section title={t('description')}>
            <p className="max-w-[72ch] whitespace-pre-line leading-relaxed text-gray-700">{textDescription}</p>
          </Section>
        )}
        <Reviews productId={product._id} headingRef={reviewsHeading} />
        <ProductFaq faqs={product.faqs} />
        <ProductCompare rows={product.comparison} />
        <AlsoLikeRow product={product} />
        <AllProductsGrid product={product} />
      </SectionStack>

      {/* Order form pop-up */}
      {!out && <OrderModal open={formOpen} onClose={closeForm} lines={priced} />}

      {/* Sticky Order now bar, every screen size: shows only after scrolling PAST the main Order now button (see
          pastCta); hidden while the order form, the cart, the drawer or a picture is open (CSS, index.css), and not
          shown for sold-out products (as before). Slides up / fades in; never takes space or focus when hidden. */}
      {!out && (
        <div
          data-show={pastCta && !formOpen ? 'true' : undefined}
          aria-hidden={!(pastCta && !formOpen)}
          inert={!(pastCta && !formOpen)}
          className="nx-sticky-bar nx-page fixed inset-x-0 bottom-0 z-[var(--z-sticky-bar)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        >
          <div className="nx-sticky-inner glass glass-float flex items-center gap-3 rounded-2xl p-2.5 ps-4">
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs text-gray-600">{(hasPacks && safeQty > 1 ? `${packLabel(safeQty, lang)} · ` : '')}{t('total')}</div>
              <div className="text-lg font-extrabold">{showFrom ? fromText : money(total)}</div>
            </div>
            <button onClick={openForm}
              className="btn-primary-glass ms-auto flex-1 px-5 sm:max-w-xs">
              {t('orderShort')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Product() {
  const { slug } = useParams()

  const [state, setState] = useState({
    slug: null,
    product: null,
    related: [],
    missing: false,
  })

  useEffect(() => {
    let cancelled = false

    fetchOnce(`/products/${slug}`)
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
      <div className="nx-page grid animate-pulse gap-10 py-8 md:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-gray-200" />

        <div className="space-y-4">
          <div className="h-8 w-2/3 rounded bg-gray-200" />
          <div className="h-8 w-1/3 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  if (state.missing || !state.product) return <MissingProduct />

  return (
    <ProductView
      key={state.product._id}
      product={state.product}
    />
  )
}

// unknown product: noindex, and the same minimum height as the loading skeleton so the footer does not jump
function MissingProduct() {
  const { t, settings } = useStore()
  usePageMeta({ title: `${t('notFound')} | ${settings.storeName || 'Nextova'}`, robots: 'noindex' })
  return (
      <div className="min-h-[70vh] px-4 py-24 text-center">
        <h1 className="mb-4 text-lg font-normal text-gray-600">
          {t('notFound')}
        </h1>

        <Link
          to="/shop"
          className="btn-primary-glass px-6"
        >
          {t('backToShop')}
        </Link>
      </div>
  )
}
