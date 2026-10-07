import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import Lead from './lead.model.js'
import Product from '../products/product.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  message: { message: 'Too many requests, please try again later' },
})

const qatarPhone = /^(?:\+?974)?[3567]\d{7}$/

const schema = z.object({
  phone: z.string().trim()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .refine((s) => qatarPhone.test(s), 'Invalid phone')
    .transform((s) => '+974' + s.slice(-8)),
  name: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  items: z.array(z.object({
    productId: z.string().length(24),
    variantName: z.string().optional(),
    qty: z.number().int().min(1).max(20),
  })).min(1).max(30),
  total: z.number().min(0).max(1000000).optional(),
  utm: z.object({
    source: z.string().max(100).optional(),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
  }).optional(),
  website: z.string().optional(), // hidden spam trap
})

// ---- public: remember an unfinished order ----
router.post('/', limiter, asyncHandler(async (req, res) => {
  const data = schema.parse(req.body)
  if (data.website) return res.status(204).end()

  // product names come from the database, never from the browser
  const products = await Product.find({ _id: { $in: data.items.map((i) => i.productId) }, isActive: true })
    .select('name').lean()
  const nameOf = Object.fromEntries(products.map((p) => [String(p._id), p.name.en]))
  const items = data.items
    .filter((i) => nameOf[i.productId])
    .map((i) => ({ product: i.productId, name: nameOf[i.productId], variantName: i.variantName, qty: i.qty }))
  if (items.length === 0) return res.status(204).end()

  const set = { items, ip: req.ip }
  if (data.name) set.name = data.name
  if (data.area) set.area = data.area
  if (data.total !== undefined) set.total = data.total
  if (data.utm) set.utm = data.utm

  // a customer who ordered before and comes back unfinished becomes a new lead again
  await Lead.updateOne({ phone: data.phone, status: 'ordered' }, { $set: { status: 'new' } })
  await Lead.findOneAndUpdate(
    { phone: data.phone },
    { $set: set, $setOnInsert: { status: 'new' } },
    { upsert: true, setDefaultsOnInsert: true })

  res.status(204).end()
}))

// ---- admin ----
router.get('/', protect, asyncHandler(async (req, res) => {
  const { status = 'new', page = 1, limit = 20 } = req.query
  const filter = status === 'all' ? {} : { status }
  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))

  const [items, total, newCount] = await Promise.all([
    Lead.find(filter).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).lean(),
    Lead.countDocuments(filter),
    Lead.countDocuments({ status: 'new' }),
  ])
  res.json({ items, total, page: p, pages: Math.ceil(total / l), newCount })
}))

router.patch('/:id/status', protect, asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!['new', 'contacted', 'ordered', 'ignored'].includes(status)) throw httpError(400, 'Invalid status')
  const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' })
  if (!lead) return res.status(404).json({ message: 'Lead not found' })
  res.json(lead)
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id)
  if (!lead) return res.status(404).json({ message: 'Lead not found' })
  res.json({ message: 'Deleted' })
}))

export default router