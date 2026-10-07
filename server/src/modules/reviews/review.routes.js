import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import Review from './review.model.js'
import Product from '../products/product.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: 'Too many reviews from this device, please try again later' },
})

const imageSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith('https://res.cloudinary.com/'), 'Invalid image'),
  publicId: z.string().optional(),
})

const createSchema = z.object({
  productId: z.string().length(24),
  name: z.string().trim().min(2).max(60),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional(),
  comment: z.string().trim().max(1000).optional(),
  images: z.array(imageSchema).max(3).optional(),
  website: z.string().optional(), // hidden spam trap
})

async function recalc(productId) {
  const [s] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])
  await Product.findByIdAndUpdate(productId, {
    ratingAvg: s ? Math.round(s.avg * 10) / 10 : 0,
    ratingCount: s ? s.count : 0,
  })
}

// ---- public ----
router.get('/latest', asyncHandler(async (req, res) => {
  const items = await Review.find({ status: 'approved' })
    .sort({ createdAt: -1 }).limit(8).select('-ip').populate('product', 'name slug').lean()
  res.json(items)
}))

router.get('/product/:productId', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) throw httpError(400, 'Invalid product')
  const pid = new mongoose.Types.ObjectId(req.params.productId)

  const [items, grouped] = await Promise.all([
    Review.find({ product: pid, status: 'approved' }).sort({ createdAt: -1 }).limit(50).select('-ip').lean(),
    Review.aggregate([
      { $match: { product: pid, status: 'approved' } },
      { $group: { _id: '$rating', n: { $sum: 1 } } },
    ]),
  ])

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let count = 0
  let sum = 0
  grouped.forEach((g) => { dist[g._id] = g.n; count += g.n; sum += g._id * g.n })

  res.json({ items, summary: { avg: count ? Math.round((sum / count) * 10) / 10 : 0, count, dist } })
}))

// customers send a review: it waits for your approval
router.post('/', submitLimiter, asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body)
  if (data.website) return res.status(201).json({ message: 'ok' })

  const product = await Product.findOne({ _id: data.productId, isActive: true })
  if (!product) throw httpError(404, 'Product not found')

  await Review.create({
    product: product._id, name: data.name, rating: data.rating, title: data.title,
    comment: data.comment, images: data.images || [], status: 'pending', source: 'customer', ip: req.ip,
  })
  res.status(201).json({ message: 'ok' })
}))

// ---- admin ----
router.get('/admin/all', protect, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const filter = status ? { status } : {}
  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))

  const [items, total, pending] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('product', 'name slug').lean(),
    Review.countDocuments(filter),
    Review.countDocuments({ status: 'pending' }),
  ])
  res.json({ items, total, page: p, pages: Math.ceil(total / l), pending })
}))

// you add a real customer's feedback yourself (e.g. from WhatsApp, with permission)
router.post('/admin', protect, asyncHandler(async (req, res) => {
  const { productId, name, rating, title, comment, images, verified } = req.body
  const product = await Product.findById(productId)
  if (!product) throw httpError(404, 'Product not found')

  const review = await Review.create({
    product: product._id, name, rating: Number(rating), title, comment,
    images: images || [], verified: !!verified, status: 'approved', source: 'admin',
  })
  await recalc(product._id)
  res.status(201).json(review)
}))

router.patch('/:id/status', protect, asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!['pending', 'approved', 'rejected'].includes(status)) throw httpError(400, 'Invalid status')
  const review = await Review.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' })
  if (!review) return res.status(404).json({ message: 'Review not found' })
  await recalc(review.product)
  res.json(review)
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id)
  if (!review) return res.status(404).json({ message: 'Review not found' })
  await recalc(review.product)
  res.json({ message: 'Deleted' })
}))

export default router