import { Router } from 'express'
import mongoose from 'mongoose'
import Product from './product.model.js'
import Category from '../categories/category.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'
import { uniqueSlug } from '../../utils/slug.js'
import { adTotalsByProduct, realCostOf } from '../../utils/realCost.js'
import Order from '../orders/order.model.js'
import Review from '../reviews/review.model.js'
import Visit from '../stats/stats.model.js'
import Settings from '../settings/settings.model.js'
import { searchProducts, invalidateSearch } from '../../utils/search.js'
import { markBestSellers, bestSellerIds, refreshBestSellers } from '../../utils/bestSellers.js'
import { optionTypesProblem, priceRange } from '../../utils/options.js'
import { httpError } from '../../utils/httpError.js'
import rateLimit from 'express-rate-limit'
import { heroProducts } from '../../utils/heroProducts.js'

const router = Router()

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { soldCount: -1 },
  rating: { ratingAvg: -1 },
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// admin view of a product: private cost fields + the real cost per unit (base cost + ads per unit)
const PRIVATE = '+costPrice +unitsPurchased +variants.cost'
async function adminView(id) {
  const [p, ads] = await Promise.all([
    Product.findById(id).select(PRIVATE).populate('category', 'name slug').lean(),
    adTotalsByProduct(),
  ])
  return p ? { ...p, ...realCostOf(p, ads[String(p._id)] || 0) } : null
}

// public: /api/v1/products?q=lock&category=kitchen&minPrice=10&maxPrice=100&onSale=true&inStock=true&sort=price_asc&page=1&limit=12
router.get('/', asyncHandler(async (req, res) => {
  const one = (v) => (Array.isArray(v) ? v[0] : v)
  const q = one(req.query.q), category = one(req.query.category), minPrice = one(req.query.minPrice)
  const maxPrice = one(req.query.maxPrice), onSale = one(req.query.onSale), inStock = one(req.query.inStock)
  const featured = one(req.query.featured), sort = one(req.query.sort) || 'newest'
  const page = one(req.query.page) || 1, limit = one(req.query.limit) || 12
  const filter = { isActive: true }

  // search: names EN/AR, category, tags, SKU, Arabic letter variants and small typos (utils/search.js)
  let ranked = null
  if (q && String(q).trim()) {
    ranked = (await searchProducts(String(q))).map((r) => r.product._id)
    filter._id = { $in: ranked.slice(0, 500) }
  }
  if (category) {
    const cat = await Category.findOne({ slug: String(category) })
    if (cat) {
      const childIds = await Category.find({ parent: cat._id }).distinct('_id')
      filter.category = { $in: [cat._id, ...childIds] }
    } else {
      filter.category = { $in: [] }
    }
  }
  const price = {}
  if (minPrice !== undefined && minPrice !== '' && Number.isFinite(Number(minPrice))) price.$gte = Number(minPrice)
  if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice))) price.$lte = Number(maxPrice)
  if (Object.keys(price).length) filter.price = price
  if (onSale === 'true') filter.$expr = { $gt: ['$compareAtPrice', '$price'] }
  if (inStock === 'true') filter.stock = { $gt: 0 }
  if (featured === 'true') filter.isFeatured = true

  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(48, Math.max(1, Number(limit) || 12))

  // a search with the default sort keeps the search ranking (best match and in stock first)
  if (ranked && (!one(req.query.sort) || sort === 'newest')) {
    const all = await Product.find(filter).select('-faqs -comparison -descriptionImages').populate('category', 'name slug').lean()
    const pos = new Map(ranked.map((id, i) => [String(id), i]))
    all.sort((a, b) => pos.get(String(a._id)) - pos.get(String(b._id)))
    const items = await markBestSellers(all.slice((p - 1) * l, p * l))
    return res.json({ items, total: all.length, page: p, pages: Math.ceil(all.length / l) })
  }

  const [items, total] = await Promise.all([
    Product.find(filter).select('-faqs -comparison -descriptionImages')
      .sort(SORTS[sort] || SORTS.newest).skip((p - 1) * l).limit(l)
      .populate('category', 'name slug').lean(),
    Product.countDocuments(filter),
  ])
  res.json({ items: await markBestSellers(items), total, page: p, pages: Math.ceil(total / l) })
}))

// admin: all products including hidden ones (with the private cost price)
router.get('/admin/all', protect, asyncHandler(async (req, res) => {
  const { q, lowStock, category, page = 1, limit = 20 } = req.query
  const filter = {}
  if (category === 'none') filter.category = null
  else if (category && mongoose.isValidObjectId(category)) filter.category = category
  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), 'i')
    filter.$or = [{ 'name.en': rx }, { 'name.ar': rx }, { sku: rx }]
  }
  if (lowStock === 'true') filter.$expr = { $lte: ['$stock', '$lowStockAlert'] }

  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))
  const [items, total, ads] = await Promise.all([
    Product.find(filter).select(PRIVATE).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l)
      .populate('category', 'name slug').lean(),
    Product.countDocuments(filter),
    adTotalsByProduct(),
  ])
  const withCost = items.map((x) => ({ ...x, ...realCostOf(x, ads[String(x._id)] || 0) }))
  res.json({ items: withCost, total, page: p, pages: Math.ceil(total / l) })
}))

// public: social proof for the product page, from REAL data only (never invented numbers)
//   bought: units in paid order lines of orders that are not cancelled or returned (free gifts not counted).
//           Product.soldCount is NOT used: it also counts free gifts and can be reset by scripts.
//   viewedWeek: unique visitors who opened this product page in the last 7 days (visitor counter)
//   liked: share of APPROVED reviews with 4 or 5 stars, and how many approved reviews there are
// The bar is hidden (show: false, no numbers) until `bought` reaches the minimum set in Settings (default 5).
const proofCache = new Map() // slug -> { at, data }
const QATAR = 3 * 60 * 60 * 1000
const dayKey = (ms) => new Date(ms + QATAR).toISOString().slice(0, 10)

router.get('/:slug/proof', asyncHandler(async (req, res) => {
  const slug = String(req.params.slug).toLowerCase()
  const hit = proofCache.get(slug)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) {
    res.set('Cache-Control', 'public, max-age=300')
    return res.json(hit.data)
  }
  const product = await Product.findOne({ slug, isActive: true }).select('_id').lean()
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const [bought, viewers, reviews, settings] = await Promise.all([
    Order.aggregate([
      { $match: { 'items.product': product._id, status: { $nin: ['cancelled', 'returned'] } } },
      { $unwind: '$items' },
      { $match: { 'items.product': product._id, 'items.price': { $gt: 0 } } },
      { $group: { _id: null, units: { $sum: '$items.qty' } } },
    ]),
    Visit.aggregate([
      { $match: { day: { $gte: dayKey(Date.now() - 6 * 24 * 60 * 60 * 1000) }, products: slug } },
      { $group: { _id: '$visitorId' } },
      { $count: 'n' },
    ]),
    Review.aggregate([
      { $match: { product: product._id, status: 'approved' } },
      { $group: { _id: null, total: { $sum: 1 }, good: { $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] } } } },
    ]),
    Settings.findOne({ key: 'main' }).select('proofMinBought').lean(),
  ])

  const units = bought[0]?.units || 0
  const min = settings?.proofMinBought || 5
  const r = reviews[0]
  const data = units >= min
    ? {
        show: true,
        bought: units,
        viewedWeek: viewers[0]?.n || 0,
        liked: r?.total ? { pct: Math.round((r.good / r.total) * 100), reviews: r.total } : null,
      }
    : { show: false }
  proofCache.set(slug, { at: Date.now(), data })
  res.set('Cache-Control', 'public, max-age=300')
  res.json(data)
}))

// public: the home page hero card products (Step 39). Only id, slug, name, picture, price, old price, saving %,
// best seller flag, rating and in-stock flag; never cost or stock numbers. Read only.
const heroLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests' } })
router.get('/hero', heroLimiter, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60')
  res.json(await heroProducts())
}))

// public: live search suggestions (picture, name, price), at most 8; with no result, popular products instead
router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').slice(0, 80)
  const limit = Math.min(8, Math.max(1, Number(req.query.limit) || 6))
  const view = (p) => ({
    _id: p._id, slug: p.slug, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice,
    // products with option types: lowest / highest combination price ("From QAR X" when they differ)
    priceMin: priceRange(p).min, priceMax: priceRange(p).max,
    image: p.images?.[0]?.url, inStock: (p.stock || 0) > 0,
    ratingAvg: p.ratingAvg || 0, ratingCount: p.ratingCount || 0,
  })
  const found = q.trim() ? (await searchProducts(q)).slice(0, limit).map((r) => view(r.product)) : []
  let popular = []
  if (found.length === 0) {
    popular = (await Product.find({ isActive: true, stock: { $gt: 0 } }).sort({ soldCount: -1 }).limit(limit)
      .select('name slug price compareAtPrice images stock ratingAvg ratingCount optionTypes variants.price variants.enabled').lean()).map(view)
  }
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ q, items: await markBestSellers(found), popular: await markBestSellers(popular) })
}))

// public: ids of the products that show the "Best seller" chip (cached one hour)
router.get('/best-sellers', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=600')
  res.json([...(await bestSellerIds())])
}))

// public: single product + related products + the free gift (only if it is available)
router.get('/:slug', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('category', 'name slug')
    .populate('freeGift.product', 'name images slug stock isActive variants')
    .lean()
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const g = product.freeGift
  let gift = null
  if (g?.enabled && g.product && g.product.isActive && g.product.stock > 0 && !g.product.variants?.length) {
    gift = {
      minQty: g.minQty || 1,
      qty: g.qty || 1,
      name: g.product.name,
      image: g.product.images?.[0]?.url,
      slug: g.product.slug,
    }
  }
  product.gift = gift
  delete product.freeGift

  const related = await Product.find({
    isActive: true, _id: { $ne: product._id }, category: product.category?._id,
  }).select('-faqs -comparison -descriptionImages').limit(4).lean()
  res.json({ product: await markBestSellers(product), related: await markBestSellers(related) })
}))

// admin: open orders per option, so the product form can warn before a value with open orders is removed (read only)
router.get('/:id/variant-usage', protect, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.json({})
  const id = new mongoose.Types.ObjectId(req.params.id)
  const rows = await Order.aggregate([
    { $match: { 'items.product': id, status: { $nin: ['delivered', 'cancelled', 'returned'] } } },
    { $unwind: '$items' },
    { $match: { 'items.product': id, 'items.variantName': { $nin: [null, ''] } } },
    { $group: { _id: '$items.variantName', orders: { $addToSet: '$_id' } } },
  ])
  res.json(Object.fromEntries(rows.map((r) => [r._id, r.orders.length])))
}))

router.post('/', protect, asyncHandler(async (req, res) => {
  const bad = optionTypesProblem(req.body)
  if (bad) throw httpError(400, bad)
  const slug = await uniqueSlug(Product, req.body.slug || req.body.name?.en)
  const doc = await Product.create({ ...req.body, slug })
  invalidateSearch(); refreshBestSellers()
  res.status(201).json(await adminView(doc._id))
}))

router.put('/:id', protect, asyncHandler(async (req, res) => {
  const bad = optionTypesProblem(req.body)
  if (bad) throw httpError(400, bad)
  const update = { ...req.body }
  if (update.slug) update.slug = await uniqueSlug(Product, update.slug, req.params.id)
  const doc = await Product.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true })
  if (!doc) return res.status(404).json({ message: 'Product not found' })
  invalidateSearch(); refreshBestSellers()
  res.json(await adminView(doc._id))
}))

router.patch('/:id/stock', protect, asyncHandler(async (req, res) => {
  const doc = await Product.findByIdAndUpdate(
    req.params.id, { stock: Number(req.body.stock) }, { returnDocument: 'after', runValidators: true })
  if (!doc) return res.status(404).json({ message: 'Product not found' })
  res.json(await adminView(doc._id))
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const doc = await Product.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Product not found' })
  invalidateSearch(); refreshBestSellers()
  res.json({ message: 'Deleted' })
}))

export default router