import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import Alert from './alert.model.js'
import Product from '../products/product.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { message: 'Too many requests, please try again later' },
})

const qatarPhone = /^(?:\+?974)?[3567]\d{7}$/

const schema = z.object({
  productId: z.string().length(24),
  variantName: z.string().max(80).optional(),
  phone: z.string().trim()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .refine((s) => qatarPhone.test(s), 'Enter a valid Qatar mobile number')
    .transform((s) => '+974' + s.slice(-8)),
  lang: z.enum(['en', 'ar']).default('en'),
  website: z.string().optional(), // hidden spam trap
})

// ---- public: "tell me when it is back" ----
router.post('/', limiter, asyncHandler(async (req, res) => {
  const data = schema.parse(req.body)
  if (data.website) return res.status(201).json({ ok: true })

  const product = await Product.findOne({ _id: data.productId, isActive: true }).select('stock variants').lean()
  if (!product) throw httpError(404, 'Product not found')

  const stock = data.variantName
    ? product.variants?.find((v) => v.name === data.variantName)?.stock ?? 0
    : product.stock
  if (stock > 0) return res.json({ available: true })

  await Alert.findOneAndUpdate(
    { product: data.productId, variantName: data.variantName ?? null, phone: data.phone },
    { $set: { lang: data.lang }, $unset: { notifiedAt: 1 }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  )
  res.status(201).json({ ok: true })
}))

// ---- admin: who is waiting, grouped by product ----
router.get('/', protect, asyncHandler(async (req, res) => {
  const alerts = await Alert.find({ notifiedAt: null }).sort({ createdAt: 1 }).limit(2000)
    .populate('product', 'name slug stock variants images').lean()

  const groups = new Map()
  for (const a of alerts) {
    if (!a.product) continue
    const stock = a.variantName
      ? a.product.variants?.find((v) => v.name === a.variantName)?.stock ?? 0
      : a.product.stock
    const key = String(a.product._id)
    if (!groups.has(key)) {
      groups.set(key, {
        product: { _id: a.product._id, name: a.product.name, slug: a.product.slug, image: a.product.images?.[0]?.url },
        alerts: [],
      })
    }
    groups.get(key).alerts.push({
      _id: a._id, phone: a.phone, variantName: a.variantName, lang: a.lang,
      createdAt: a.createdAt, available: stock > 0,
    })
  }

  const ready = (g) => g.alerts.filter((a) => a.available).length
  res.json([...groups.values()].sort((x, y) => ready(y) - ready(x)))
}))

router.patch('/:id/notified', protect, asyncHandler(async (req, res) => {
  const a = await Alert.findByIdAndUpdate(req.params.id, { notifiedAt: new Date() }, { returnDocument: 'after' })
  if (!a) return res.status(404).json({ message: 'Not found' })
  res.json(a)
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  await Alert.findByIdAndDelete(req.params.id)
  res.json({ message: 'Deleted' })
}))

export default router