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

const router = Router()

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    message: 'Too many orders from this device, please try again later',
  },
})

// Qatar mobile numbers: 8 digits starting with 3, 5, 6 or 7
const qatarPhone = /^(?:\+974)?[3567]\d{7}$/

const createSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),

    phone: z.string()
      .trim()
      .transform((s) => s.replace(/[\s-]/g, ''))
      .refine(
        (s) => qatarPhone.test(s),
        'Enter a valid Qatar phone number'
      )
      .transform((s) => '+974' + s.slice(-8)),

    area: z.string().trim().max(80).optional(),

    address: z.string().trim().min(3).max(300),

    notes: z.string().trim().max(500).optional(),
  }),

  items: z.array(
    z.object({
      productId: z.string().length(24),
      variantName: z.string().optional(),
      qty: z.number().int().min(1).max(20),
    })
  ).min(1).max(30),

  source: z.enum(['website', 'whatsapp']).default('website'),

  utm: z.object({
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
  }).optional(),

  // Hidden honeypot field.
  // Real customers should leave this empty.
  website: z.string().optional(),
})


// ---------------------------------------------------------
// STOCK HELPERS
// Atomic updates prevent two customers from buying
// the same final stock.
// ---------------------------------------------------------

async function reserveStock(productId, variantName, qty) {
  const res = variantName
    ? await Product.updateOne(
        {
          _id: productId,
          variants: {
            $elemMatch: {
              name: variantName,
              stock: { $gte: qty },
            },
          },
        },
        {
          $inc: {
            'variants.$.stock': -qty,
            stock: -qty,
            soldCount: qty,
          },
        }
      )
    : await Product.updateOne(
        {
          _id: productId,
          stock: { $gte: qty },
        },
        {
          $inc: {
            stock: -qty,
            soldCount: qty,
          },
        }
      )

  return res.modifiedCount === 1
}

async function releaseStock(productId, variantName, qty) {
  if (variantName) {
    await Product.updateOne(
      {
        _id: productId,
        'variants.name': variantName,
      },
      {
        $inc: {
          'variants.$.stock': qty,
          stock: qty,
          soldCount: -qty,
        },
      }
    )
  } else {
    await Product.updateOne(
      { _id: productId },
      {
        $inc: {
          stock: qty,
          soldCount: -qty,
        },
      }
    )
  }
}


// ---------------------------------------------------------
// PUBLIC: PLACE AN ORDER
// ---------------------------------------------------------

router.post(
  '/',
  orderLimiter,
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body)

    // Bot protection: return fake success response
    if (data.website) {
      return res.status(201).json({
        orderNumber: 'NX-0000',
        total: 0,
      })
    }

    const settings =
      (await Settings.findOne({ key: 'main' })) || {}

    const reserved = []
    const lines = []

    let order

    try {
      for (const it of data.items) {
        const product = await Product.findOne({
          _id: it.productId,
          isActive: true,
        }).select('+costPrice')

        if (!product) {
          throw httpError(
            400,
            'A product in your cart is no longer available'
          )
        }

        let unitPrice = product.price
        let variantName

        // Handle variants
        if (product.variants.length) {
          const variant = product.variants.find(
            (v) => v.name === it.variantName
          )

          if (!variant) {
            throw httpError(
              400,
              `Please choose an option for ${product.name.en}`
            )
          }

          variantName = variant.name

          if (variant.price) {
            unitPrice = variant.price
          }
        }

        // Reserve stock atomically
        if (
          !(await reserveStock(
            product._id,
            variantName,
            it.qty
          ))
        ) {
          throw httpError(
            409,
            `Sorry, ${product.name.en}${
              variantName ? ` (${variantName})` : ''
            } is out of stock`
          )
        }

        reserved.push({
          id: product._id,
          variantName,
          qty: it.qty,
        })

        lines.push({
          product: product._id,
          name: product.name.en,
          variantName,
          price: unitPrice,
          cost: product.costPrice || 0,
          qty: it.qty,
          image: product.images?.[0]?.url,
        })
      }

      // Calculate totals
      const subtotal = lines.reduce(
        (sum, line) => sum + line.price * line.qty,
        0
      )

      const freeFrom =
        settings.freeDeliveryThreshold || 0

      const deliveryFee =
        freeFrom > 0 && subtotal >= freeFrom
          ? 0
          : settings.deliveryFee || 0

      // Create order
      order = await Order.create({
        customer: data.customer,
        items: lines,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        shippingCost:
          Number(settings.shippingCostPerOrder) || 0,
        source: data.source,
        utm: data.utm,
        ip: req.ip,
      })
    } catch (err) {
      // Release any stock reserved before the error
      for (const r of reserved) {
        await releaseStock(
          r.id,
          r.variantName,
          r.qty
        )
      }

      throw err
    }

    // Email should not block order creation
    sendOrderEmail(order, settings).catch((e) =>
      console.error('Order email error:', e.message)
    )

    res.status(201).json({
      orderNumber: order.orderNumber,
      total: order.total,
    })
  })
)


// ---------------------------------------------------------
// PUBLIC: RECENT REAL ORDERS
// Used for "Someone just ordered" popup.
// ---------------------------------------------------------

router.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const since = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    )

    const orders = await Order.find({
      createdAt: { $gte: since },
      status: {
        $nin: ['cancelled', 'returned'],
      },
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .select(
        'customer.name customer.area items createdAt'
      )
      .populate('items.product', 'name slug')
      .lean()

    const list = orders
      .map((o) => {
        const it = o.items?.[0]

        const firstName = (o.customer?.name || '')
          .trim()
          .split(/\s+/)[0]

        if (!it || !firstName) {
          return null
        }

        return {
          firstName,
          area: o.customer?.area,
          createdAt: o.createdAt,
          product: {
            name: it.product?.name || {
              en: it.name,
            },
            slug: it.product?.slug,
            image: it.image,
          },
        }
      })
      .filter(Boolean)

    res.set(
      'Cache-Control',
      'public, max-age=60'
    )

    res.json(list)
  })
)


// ---------------------------------------------------------
// ADMIN: STATS
// ---------------------------------------------------------

router.get(
  '/stats',
  protect,
  asyncHandler(async (req, res) => {
    const startOfDay = new Date()

    startOfDay.setHours(0, 0, 0, 0)

    const [byStatus, today] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startOfDay,
            },
            status: {
              $nin: ['cancelled', 'returned'],
            },
          },
        },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
      ]),
    ])

    res.json({
      byStatus,
      today:
        today[0] || {
          orders: 0,
          revenue: 0,
        },
    })
  })
)


// ---------------------------------------------------------
// ADMIN: GET ORDERS
// ---------------------------------------------------------

router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const {
      status,
      q,
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query

    const filter = {}

    if (status) {
      filter.status = status
    }

    if (q) {
      // Escape regex special characters
      const escapedQuery = String(q).replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      )

      const rx = new RegExp(
        escapedQuery,
        'i'
      )

      filter.$or = [
        { orderNumber: rx },
        { 'customer.phone': rx },
        { 'customer.name': rx },
      ]
    }

    if (from || to) {
      filter.createdAt = {}

      if (from) {
        filter.createdAt.$gte = new Date(from)
      }

      if (to) {
        filter.createdAt.$lte = new Date(to)
      }
    }

    const p = Math.max(
      1,
      Number(page) || 1
    )

    const l = Math.min(
      100,
      Math.max(
        1,
        Number(limit) || 20
      )
    )

    const [items, total] =
      await Promise.all([
        Order.find(filter)
          .sort({ createdAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .populate(
            'items.product',
            'slug'
          )
          .lean(),

        Order.countDocuments(filter),
      ])

    res.json({
      items,
      total,
      page: p,
      pages: Math.ceil(total / l),
    })
  })
)


// ---------------------------------------------------------
// ADMIN: GET SINGLE ORDER
// ---------------------------------------------------------

router.get(
  '/:id',
  protect,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(
      req.params.id
    )
      .populate('items.product', 'slug')
      .lean()

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      })
    }

    res.json(order)
  })
)


// ---------------------------------------------------------
// ADMIN: UPDATE ORDER STATUS
// ---------------------------------------------------------

router.patch(
  '/:id/status',
  protect,
  asyncHandler(async (req, res) => {
    const { status, note } = req.body

    if (!ORDER_STATUSES.includes(status)) {
      throw httpError(
        400,
        'Invalid status'
      )
    }

    const order = await Order.findById(
      req.params.id
    )

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      })
    }

    const closed = [
      'cancelled',
      'returned',
    ]

    // Return stock when order becomes
    // cancelled/returned
    if (
      closed.includes(status) &&
      !closed.includes(order.status)
    ) {
      for (const it of order.items) {
        await releaseStock(
          it.product,
          it.variantName,
          it.qty
        )
      }
    }

    order.status = status

    order.deliveredAt =
      status === 'delivered'
        ? new Date()
        : undefined

    order.statusHistory.push({
      status,
      note,
    })

    await order.save()

    await order.populate(
      'items.product',
      'slug'
    )

    res.json(order)
  })
)


// ---------------------------------------------------------
// ADMIN: UPDATE NOTES
// ---------------------------------------------------------

router.patch(
  '/:id/notes',
  protect,
  asyncHandler(async (req, res) => {
    const order =
      await Order.findByIdAndUpdate(
        req.params.id,
        {
          adminNotes: String(
            req.body.adminNotes || ''
          ),
        },
        {
          returnDocument: 'after',
        }
      )

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      })
    }

    await order.populate(
      'items.product',
      'slug'
    )

    res.json(order)
  })
)


// ---------------------------------------------------------
// ADMIN: UPDATE SHIPPING COST
// ---------------------------------------------------------

router.patch(
  '/:id/costs',
  protect,
  asyncHandler(async (req, res) => {
    const shippingCost = Number(
      req.body.shippingCost
    )

    if (
      !Number.isFinite(shippingCost) ||
      shippingCost < 0
    ) {
      throw httpError(
        400,
        'Invalid shipping cost'
      )
    }

    const order =
      await Order.findByIdAndUpdate(
        req.params.id,
        { shippingCost },
        {
          returnDocument: 'after',
        }
      )

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      })
    }

    await order.populate(
      'items.product',
      'slug'
    )

    res.json(order)
  })
)

export default router