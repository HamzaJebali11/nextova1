import { Router } from 'express'
import Product from './product.model.js'
import Category from '../categories/category.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'
import { uniqueSlug } from '../../utils/slug.js'

const router = Router()

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { soldCount: -1 },
  rating: { ratingAvg: -1 },
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// public: /api/v1/products?q=lock&category=kitchen&minPrice=10&maxPrice=100&onSale=true&inStock=true&sort=price_asc&page=1&limit=12
router.get('/', asyncHandler(async (req, res) => {
  const { q, category, minPrice, maxPrice, onSale, inStock, featured, sort = 'newest', page = 1, limit = 12 } = req.query
  const filter = { isActive: true }

  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), 'i')
    filter.$or = [{ 'name.en': rx }, { 'name.ar': rx }, { tags: rx }]
  }
  if (category) {
    const cat = await Category.findOne({ slug: category })
    if (cat) {
      const childIds = await Category.find({ parent: cat._id }).distinct('_id')
      filter.category = { $in: [cat._id, ...childIds] }
    } else {
      filter.category = { $in: [] }
    }
  }
  if (minPrice || maxPrice) {
    filter.price = {}
    if (minPrice) filter.price.$gte = Number(minPrice)
    if (maxPrice) filter.price.$lte = Number(maxPrice)
  }
  if (onSale === 'true') filter.$expr = { $gt: ['$compareAtPrice', '$price'] }
  if (inStock === 'true') filter.stock = { $gt: 0 }
  if (featured === 'true') filter.isFeatured = true

  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(48, Math.max(1, Number(limit) || 12))

  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[sort] || SORTS.newest).skip((p - 1) * l).limit(l)
      .populate('category', 'name slug').lean(),
    Product.countDocuments(filter),
  ])
  res.json({ items, total, page: p, pages: Math.ceil(total / l) })
}))

// admin: all products including hidden ones
router.get('/admin/all', protect, asyncHandler(async (req, res) => {
  const { q, lowStock, page = 1, limit = 20 } = req.query
  const filter = {}
  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), 'i')
    filter.$or = [{ 'name.en': rx }, { 'name.ar': rx }, { sku: rx }]
  }
  if (lowStock === 'true') filter.$expr = { $lte: ['$stock', '$lowStockAlert'] }

  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l)
      .populate('category', 'name slug').lean(),
    Product.countDocuments(filter),
  ])
  res.json({ items, total, page: p, pages: Math.ceil(total / l) })
}))

// public: single product + related products (good for upsells)
router.get('/:slug', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('category', 'name slug').lean()
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const related = await Product.find({
    isActive: true, _id: { $ne: product._id }, category: product.category?._id,
  }).limit(4).lean()
  res.json({ product, related })
}))

router.post('/', protect, asyncHandler(async (req, res) => {
  const slug = await uniqueSlug(Product, req.body.slug || req.body.name?.en)
  res.status(201).json(await Product.create({ ...req.body, slug }))
}))

router.put('/:id', protect, asyncHandler(async (req, res) => {
  const update = { ...req.body }
  if (update.slug) update.slug = await uniqueSlug(Product, update.slug, req.params.id)
  const doc = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
  if (!doc) return res.status(404).json({ message: 'Product not found' })
  res.json(doc)
}))

router.patch('/:id/stock', protect, asyncHandler(async (req, res) => {
  const doc = await Product.findByIdAndUpdate(
    req.params.id, { stock: Number(req.body.stock) }, { new: true, runValidators: true })
  if (!doc) return res.status(404).json({ message: 'Product not found' })
  res.json(doc)
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const doc = await Product.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Product not found' })
  res.json({ message: 'Deleted' })
}))

export default router