import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import Order, { ORDER_STATUSES } from './order.model.js'
import Product from '../products/product.model.js'
import Settings from '../settings/settings.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many orders from this device, please try again later' },
})

const qatarPhone = /^(?:\+?974)?[3567]\d{7}$/

const createSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim()
      .transform((s) => s.replace(/[\s-]/g, ''))
      .refine((s) => qatarPhone.test(s), 'Enter a valid Qatar phone number')
      .transform((s) => '+974' + s.slice(-8)),
    area: z.string().trim().max(80).optional(),
    address: z.string().trim().min(3).max(300),
    notes: z.string().trim().max(500).optional(),
  }),
  items: z.array(z.object({
    productId: z.string().length(24),
    variantName: z.string().optional(),
    qty: z.number().int().min(1).max(20),
  })).min(1).max(30),
  source: z.enum(['website', 'whatsapp']).default('website'),
  utm: z.object({
    source: z.string().optional(), medium: z.string().optional(), campaign: z.string().optional(),
  }).optional(),
  website: z.string().optional(), // hidden "honeypot" field: real people leave it empty
})

// ---- stock helpers (atomic, so two buyers can't take the last item) ----
async function reserveStock(productId, variantName, qty) {
  const res = variantName
    ? await Product.updateOne(
        { _id: productId, variants: { $elemMatch: { name: variantName, stock: { $gte: qty } } } },
        { $inc: { 'variants.$.stock': -qty, stock: -qty, soldCount: qty } })
    : await Product.updateOne(
        { _id: productId, stock: { $gte: qty } },
        { $inc: { stock: -qty, soldCount: qty } })
  return res.modifiedCount === 1
}

async function releaseStock(productId, variantName, qty) {
  if (variantName) {
    await Product.updateOne({ _id: productId, 'variants.name': variantName },
      { $inc: { 'variants.$.stock': qty, stock: qty, soldCount: -qty } })
  } else {
    await Product.updateOne({ _id: productId }, { $inc: { stock: qty, soldCount: -qty } })
  }
}

// ---- public: place an order ----
router.post('/', orderLimiter, asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body)
  if (data.website) return res.status(201).json({ orderNumber: 'NX-0000', total: 0 }) // bot: fake success

  const settings = (await Settings.findOne({ key: 'main' })) || {}
  const reserved = []
  const lines = []

  try {
    for (const it of data.items) {
      const product = await Product.findOne({ _id: it.productId, isActive: true })
      if (!product) throw httpError(400, 'A product in your cart is no longer available')

      let unitPrice = product.price
      let variantName
      if (product.variants.length) {
        const variant = product.variants.find((v) => v.name === it.variantName)
        if (!variant) throw httpError(400, `Please choose an option for ${product.name.en}`)
        variantName = variant.name
        if (variant.price) unitPrice = variant.price
      }

      if (!(await reserveStock(product._id, variantName, it.qty))) {
        throw httpError(409, `Sorry, ${product.name.en}${variantName ? ` (${variantName})` : ''} is out of stock`)
      }
      reserved.push({ id: product._id, variantName, qty: it.qty })
      lines.push({
        product: product._id, name: product.name.en, variantName,
        price: unitPrice, qty: it.qty, image: product.images?.[0]?.url,
      })
    }

    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
    const freeFrom = settings.freeDeliveryThreshold || 0
    const deliveryFee = freeFrom > 0 && subtotal >= freeFrom ? 0 : settings.deliveryFee || 0

    const order = await Order.create({
      customer: data.customer, items: lines, subtotal, deliveryFee,
      total: subtotal + deliveryFee, source: data.source, utm: data.utm, ip: req.ip,
    })
    res.status(201).json({ orderNumber: order.orderNumber, total: order.total })
  } catch (err) {
    for (const r of reserved) await releaseStock(r.id, r.variantName, r.qty) // undo reservations
    throw err
  }
}))

// ---- admin ----
router.get('/stats', protect, asyncHandler(async (req, res) => {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const [byStatus, today] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfDay }, status: { $nin: ['cancelled', 'returned'] } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]),
  ])
  res.json({ byStatus, today: today[0] || { orders: 0, revenue: 0 } })
}))

router.get('/', protect, asyncHandler(async (req, res) => {
  const { status, q, from, to, page = 1, limit = 20 } = req.query
  const filter = {}
  if (status) filter.status = status
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ orderNumber: rx }, { 'customer.phone': rx }, { 'customer.name': rx }]
  }
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
    Order.countDocuments(filter),
  ])
  res.json({ items, total, page: p, pages: Math.ceil(total / l) })
}))

router.get('/:id', protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean()
  if (!order) return res.status(404).json({ message: 'Order not found' })
  res.json(order)
}))

router.patch('/:id/status', protect, asyncHandler(async (req, res) => {
  const { status, note } = req.body
  if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Invalid status')

  const order = await Order.findById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found' })

  const closed = ['cancelled', 'returned']
  if (closed.includes(status) && !closed.includes(order.status)) {
    for (const it of order.items) await releaseStock(it.product, it.variantName, it.qty) // put items back
  }
  order.status = status
  order.statusHistory.push({ status, note })
  await order.save()
  res.json(order)
}))

router.patch('/:id/notes', protect, asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id, { adminNotes: String(req.body.adminNotes || '') }, { new: true })
  if (!order) return res.status(404).json({ message: 'Order not found' })
  res.json(order)
}))

export default router