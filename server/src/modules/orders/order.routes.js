import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import Order, { ORDER_STATUSES } from './order.model.js'
import Product from '../products/product.model.js'
import Settings from '../settings/settings.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'
import { sendOrderEmail } from '../../utils/mailer.js'
import { bestTotal } from '../../utils/pricing.js'
import { reserveStock, releaseStock } from '../../utils/stock.js'

const router = Router()

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many orders from this device, please try again later' },
})

const qatarPhone = /^(?:\+?974)?[3567]\d{7}$/
const addressCode = z.string().trim().regex(/^[0-9A-Za-z/-]{1,10}$/, 'Enter a valid number')

const createSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim()
      .transform((s) => s.replace(/[\s-]/g, ''))
      .refine((s) => qatarPhone.test(s), 'Enter a valid Qatar phone number')
      .transform((s) => '+974' + s.slice(-8)),
    area: z.string().trim().max(80).optional(),
    zone: addressCode,
    street: addressCode,
    building: addressCode,
    address: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  items: z.array(z.object({
    productId: z.string().length(24),
    variantName: z.string().optional(),
    qty: z.number().int().min(1).max(20),
  })).min(1).max(30),
  offer: z.boolean().optional(), // the "leaving" discount (only works if you switched it on)
  source: z.enum(['website', 'whatsapp']).default('website'),
  utm: z.object({
    source: z.string().optional(), medium: z.string().optional(), campaign: z.string().optional(),
  }).optional(),
  website: z.string().optional(), // hidden "honeypot" field: real people leave it empty
})

const r2 = (n) => Math.round(n * 100) / 100

// ---- public: place an order ----
router.post('/', orderLimiter, asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body)
  if (data.website) return res.status(201).json({ orderNumber: 'NX-0000', total: 0 }) // bot: fake success

  const settings = (await Settings.findOne({ key: 'main' })) || {}
  const reserved = []
  const lines = []
  const notes = []
  let order

  try {
    const ids = [...new Set(data.items.map((i) => i.productId))]
    const products = await Product.find({ _id: { $in: ids }, isActive: true }).select('+costPrice')
    const byId = new Map(products.map((p) => [String(p._id), p]))

    // 1) check every line
    const rows = data.items.map((it) => {
      const product = byId.get(it.productId)
      if (!product) throw httpError(400, 'A product in your cart is no longer available')
      let variant = null
      if (product.variants.length) {
        variant = product.variants.find((v) => v.name === it.variantName)
        if (!variant) throw httpError(400, `Please choose an option for ${product.name.en}`)
      }
      // a variant with its own price is sold at that price, without pack offers
      return { it, product, variant, pooled: !(variant && variant.price) }
    })

    // 2) lines of the same product share the pack offers (1 red + 1 blue counts as 2 for "2 packs")
    const allQty = {}
    const pooledQty = {}
    for (const r of rows) {
      const id = String(r.product._id)
      allQty[id] = (allQty[id] || 0) + r.it.qty
      if (r.pooled) pooledQty[id] = (pooledQty[id] || 0) + r.it.qty
    }
    const unitPrice = {}
    for (const [id, q] of Object.entries(pooledQty)) {
      const p = byId.get(id)
      unitPrice[id] = bestTotal(q, p.price, p.packs) / q
    }

    // 3) reserve stock and build the order lines (price always comes from the database)
    for (const r of rows) {
      const id = String(r.product._id)
      if (!(await reserveStock(r.product._id, r.variant?.name, r.it.qty))) {
        throw httpError(409, `Sorry, ${r.product.name.en}${r.variant ? ` (${r.variant.name})` : ''} is out of stock`)
      }
      reserved.push({ id: r.product._id, variantName: r.variant?.name, qty: r.it.qty })
      lines.push({
        product: r.product._id,
        name: r.product.name.en,
        variantName: r.variant?.name,
        price: r.pooled ? unitPrice[id] : r.variant.price,
        cost: r.product.costPrice || 0,
        qty: r.it.qty,
        image: r.variant?.image || r.product.images?.[0]?.url,
      })
    }

    // 4) free gifts for buying a product
    const gifts = new Map() // gift product id -> total quantity
    for (const [id, q] of Object.entries(allQty)) {
      const g = byId.get(id).freeGift
      if (g?.enabled && g.product && String(g.product) !== id) {
        const times = Math.floor(q / (g.minQty || 1))
        if (times > 0) gifts.set(String(g.product), (gifts.get(String(g.product)) || 0) + times * (g.qty || 1))
      }
    }
    for (const [giftId, qty] of gifts) {
      const gift = await Product.findOne({ _id: giftId, isActive: true }).select('+costPrice')
      if (!gift || gift.variants.length || !(await reserveStock(gift._id, undefined, qty))) {
        notes.push(`Free gift not included (unavailable): ${gift?.name?.en || giftId} x${qty}`)
        continue
      }
      reserved.push({ id: gift._id, variantName: undefined, qty })
      lines.push({
        product: gift._id, name: `${gift.name.en} (free gift)`, price: 0,
        cost: gift.costPrice || 0, qty, image: gift.images?.[0]?.url,
      })
    }

    // 5) totals (the percentage offer works once per phone number and only if you switched it on)
    const subtotal = r2(lines.reduce((s, l) => s + l.price * l.qty, 0))
    let discount = 0
    let couponCode
    const offer = settings.exitOffer
    if (data.offer && offer?.enabled && offer.percent > 0) {
      const used = await Order.exists({
        'customer.phone': data.customer.phone, couponCode: 'EXIT_OFFER', status: { $ne: 'cancelled' },
      })
      if (!used) {
        discount = r2((subtotal * Math.min(50, offer.percent)) / 100)
        couponCode = 'EXIT_OFFER'
      }
    }
    const afterDiscount = r2(subtotal - discount)
    const freeFrom = settings.freeDeliveryThreshold || 0
    const deliveryFee = freeFrom > 0 && afterDiscount >= freeFrom ? 0 : settings.deliveryFee || 0

    order = await Order.create({
      customer: data.customer, items: lines, subtotal, discount, couponCode, deliveryFee,
      total: r2(afterDiscount + deliveryFee), shippingCost: Number(settings.shippingCostPerOrder) || 0,
      source: data.source, utm: data.utm, ip: req.ip,
      adminNotes: notes.join('\n') || undefined,
    })
  } catch (err) {
    // only undo the stock if the order was NOT saved
    for (const r of reserved) await releaseStock(r.id, r.variantName, r.qty)
    throw err
  }

  sendOrderEmail(order, settings).catch((e) => console.error('Order email error:', e.message))
  res.status(201).json({ orderNumber: order.orderNumber, total: order.total })
}))

// ---- public: recent real orders for the "someone just ordered" popup ----
router.get('/recent', asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const orders = await Order.find({ createdAt: { $gte: since }, status: { $nin: ['cancelled', 'returned'] } })
    .sort({ createdAt: -1 })
    .limit(15)
    .select('customer.name customer.area items createdAt')
    .populate('items.product', 'name slug')
    .lean()

  const list = orders.map((o) => {
    const it = o.items?.[0]
    const firstName = (o.customer?.name || '').trim().split(/\s+/)[0]
    if (!it || !firstName) return null
    return {
      firstName,
      area: o.customer?.area,
      createdAt: o.createdAt,
      product: { name: it.product?.name || { en: it.name }, slug: it.product?.slug, image: it.image },
    }
  }).filter(Boolean)

  res.set('Cache-Control', 'public, max-age=60')
  res.json(list)
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
  const { status, q, from, to, zone, source, page = 1, limit = 20 } = req.query
  const filter = {}
  if (status) filter.status = status
  if (zone) filter['customer.zone'] = String(zone).trim()
  if (source === 'website') filter.source = 'website'
  else if (source === 'other') filter.source = { $ne: 'website' }
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
    Order.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('items.product', 'slug').lean(),
    Order.countDocuments(filter),
  ])
  res.json({ items, total, page: p, pages: Math.ceil(total / l) })
}))

router.get('/:id', protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('items.product', 'slug').lean()
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
  order.deliveredAt = status === 'delivered' ? new Date() : undefined
  order.statusHistory.push({ status, note })
  await order.save()
  await order.populate('items.product', 'slug')
  res.json(order)
}))

router.patch('/:id/notes', protect, asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id, { adminNotes: String(req.body.adminNotes || '') }, { returnDocument: 'after' })
  if (!order) return res.status(404).json({ message: 'Order not found' })
  await order.populate('items.product', 'slug')
  res.json(order)
}))

// what delivery cost you for this order
router.patch('/:id/costs', protect, asyncHandler(async (req, res) => {
  const shippingCost = Number(req.body.shippingCost)
  if (!Number.isFinite(shippingCost) || shippingCost < 0) throw httpError(400, 'Invalid shipping cost')
  const order = await Order.findByIdAndUpdate(req.params.id, { shippingCost }, { returnDocument: 'after' })
  if (!order) return res.status(404).json({ message: 'Order not found' })
  await order.populate('items.product', 'slug')
  res.json(order)
}))

export default router