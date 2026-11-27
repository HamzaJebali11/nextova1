import Product from '../modules/products/product.model.js'
import Settings from '../modules/settings/settings.model.js'
import { bestSellerIds } from './bestSellers.js'
import { hasOptionTypes, isOn, priceRange } from './options.js'

// Home page hero card (Step 39). READ ONLY: never writes the settings or a product.
// Only visible (isActive) products that can really be bought now: a product with option types needs a
// switched-on combination with stock; other products need stock > 0 (same as the storefront).
const MAX = 5
const FIELDS = 'name slug price compareAtPrice images stock isActive createdAt soldCount bestSeller ratingAvg ratingCount optionTypes variants.price variants.enabled variants.stock'

const inStock = (p) => (hasOptionTypes(p)
  ? (p.variants || []).some((v) => isOn(v) && (Number(v.stock) || 0) > 0)
  : (Number(p.stock) || 0) > 0)

// only what the card needs (no cost, no stock numbers)
function view(p, best) {
  const { min, max } = priceRange(p)
  const ranged = min !== max // "From QAR X": no old price, like the product cards
  const old = !ranged && Number(p.compareAtPrice) > Number(p.price) ? Number(p.compareAtPrice) : null
  return {
    id: String(p._id),
    slug: p.slug,
    name: { en: p.name?.en || '', ar: p.name?.ar || '' },
    image: p.images?.[0]?.url || null,
    price: ranged ? min : p.price,
    from: ranged,
    oldPrice: old,
    savePct: old ? Math.round((1 - p.price / old) * 100) : 0,
    bestSeller: best.has(String(p._id)),
    ratingAvg: p.ratingAvg || 0,
    ratingCount: p.ratingCount || 0,
    inStock: true,
  }
}

async function auto(best) {
  const list = (await Product.find({ isActive: true, stock: { $gt: 0 } }).sort({ createdAt: -1 }).limit(200).select(FIELDS).lean()).filter(inStock)
  const top = list.filter((p) => best.has(String(p._id))).sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
  const rest = list.filter((p) => !best.has(String(p._id))) // newest first
  return [...top, ...rest].slice(0, MAX)
}

export async function heroProducts() {
  const s = await Settings.findOne({ key: 'main' }).select('hero').lean()
  const seconds = Math.min(10, Math.max(2, Number(s?.hero?.seconds) || 3))
  const best = await bestSellerIds().catch(() => new Set())
  let list = []
  if (s?.hero?.mode === 'manual' && s.hero.products?.length) {
    const ids = s.hero.products.map(String)
    const found = await Product.find({ _id: { $in: ids }, isActive: true }).select(FIELDS).lean()
    const byId = new Map(found.map((p) => [String(p._id), p]))
    list = ids.map((id) => byId.get(id)).filter((p) => p && inStock(p)).slice(0, MAX)
  }
  const mode = list.length ? (s?.hero?.mode || 'auto') : 'auto' // none of the chosen products can be shown: automatic list
  if (!list.length) list = await auto(best)
  return { seconds, mode, items: list.map((p) => view(p, best)) }
}
