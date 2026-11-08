import { Router } from 'express'
import { z } from 'zod'
import Order, { ORDER_STATUSES } from './order.model.js'
import Product from '../products/product.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'
import { reserveStock, releaseStock } from '../../utils/stock.js'

const router = Router()
router.use(protect)

const r2 = (n) => Math.round(n * 100) / 100
const CLOSED = ['cancelled', 'returned']
const code = z.string().trim().max(10).regex(/^[0-9A-Za-z/-]*$/, 'Use letters, numbers, / or -').optional()

const itemSchema = z.object({
  productId: z.string().length(24),
  variantName: z.string().max(80).optional(),
  qty: z.number().int().min(1).max(1000),
  price: z.number().min(0).max(1000000),
  cost: z.number().min(0).max(1000000).optional(),
})

const schema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim()
      .transform((s) => s.replace(/[\s-]/g, ''))
      .refine((s) => s === '' || /^(?:\+?974)?[3567]\d{7}$/.test(s), 'Enter a valid Qatar mobile number')
      .transform((s) => (s ? '+974' + s.slice(-8) : 'N/A')),
    area: z.string().trim().max(80).optional(),
    zone: code,
    street: code,
    building: code,
    address: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  items: z.array(itemSchema).min(1).max(50),
  deliveryFee: z.number().min(0).max(100000).default(0),
  discount: z.number().min(0).max(1000000).default(0),
  shippingCost: z.number().min(0).max(100000).default(0),
  status: z.enum(ORDER_STATUSES).default('new'),
  source: z.enum(['whatsapp', 'messenger', 'instagram', 'phone', 'other']).default('whatsapp'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // set for a past sale (Qatar date)
  takeStock: z.boolean().default(true),
  adminNotes: z.string().trim().max(500).optional(),
})

// register an order you took on WhatsApp / Messenger / phone, or a past sale
router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body)
  const past = !!data.date
  if (!past && data.customer.phone === 'N/A') throw httpError(400, 'Enter the customer mobile number')

  const closed = CLOSED.includes(data.status)
  const takeStock = data.takeStock && !closed
  const reserved = []

  try {
    const ids = [...new Set(data.items.map((i) => i.productId))]
    const products = await Product.find({ _id: { $in: ids } }).select('+costPrice')
    const byId = new Map(products.map((p) => [String(p._id), p]))

    const lines = []
    for (const it of data.items) {
      const p = byId.get(it.productId)
      if (!p) throw httpError(400, 'A product was not found')

      let variant = null
      if (p.variants.length) {
        variant = p.variants.find((v) => v.name === it.variantName)
        if (!variant) throw httpError(400, `Choose an option for ${p.name.en}`)
      }

      if (takeStock) {
        if (!(await reserveStock(p._id, variant?.name, it.qty))) {
          throw httpError(409, `Not enough stock: ${p.name.en}${variant ? ` (${variant.name})` : ''}`)
        }
        reserved.push({ id: p._id, variantName: variant?.name, qty: it.qty })
      }

      lines.push({
        product: p._id,
        name: p.name.en,
        variantName: variant?.name,
        price: it.price,
        cost: it.cost ?? p.costPrice ?? 0,
        qty: it.qty,
        image: variant?.image || p.images?.[0]?.url,
      })
    }

    const subtotal = r2(lines.reduce((s, l) => s + l.price * l.qty, 0))
    const discount = Math.min(data.discount, subtotal)
    const when = past ? new Date(`${data.date}T12:00:00+03:00`) : null

    const order = new Order({
      customer: data.customer,
      items: lines,
      subtotal,
      discount,
      deliveryFee: data.deliveryFee,
      total: r2(subtotal - discount + data.deliveryFee),
      shippingCost: data.shippingCost,
      status: data.status,
      source: data.source,
      adminNotes: data.adminNotes,
      stockTaken: takeStock,
    })
    if (data.status === 'delivered') order.deliveredAt = when || new Date()
    order.$locals.skipNotify = true // you register it yourself: no automatic WhatsApp message
    await order.save()

    // a past sale keeps its real date (so your charts and profit land on the right day)
    if (when) await Order.updateOne({ _id: order._id }, { createdAt: when, updatedAt: when }, { timestamps: false })

    // sales you did not take from stock still count as "sold"
    if (!takeStock && !closed) {
      for (const l of lines) await Product.updateOne({ _id: l.product }, { $inc: { soldCount: l.qty } })
    }

    res.status(201).json({ id: order._id, orderNumber: order.orderNumber, total: order.total })
  } catch (err) {
    for (const r of reserved) await releaseStock(r.id, r.variantName, r.qty)
    throw err
  }
}))

export default router