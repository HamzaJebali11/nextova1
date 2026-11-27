import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import Order, { ORDER_STATUSES, FAIL_REASONS } from './order.model.js'
import Product from '../products/product.model.js'
import Settings from '../settings/settings.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'
import { sendOrderEmail } from '../../utils/mailer.js'
import { priceFor, MAX_LINE } from '../../utils/pricing.js'
import { reserveStock, releaseStock } from '../../utils/stock.js'
import { comboDetails, comboProblem, ownCost } from '../../utils/options.js'
import { withRealCost } from '../../utils/realCost.js'
import { attributionFilter, adKeyOf } from '../../utils/attribution.js'
import { liveEvent } from '../events/event.routes.js'
import { qatarPhoneField } from '../../utils/phone.js'
import { orderFlags, isFlagged, FLAGGED } from '../../utils/orderFlags.js'

const router = Router()

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many orders from this device, please try again later' },
})

const addressCode = z.string().trim().regex(/^[0-9A-Za-z/-]{1,10}$/, 'Enter a valid number')

const txt = z.string().trim().max(300).optional()

const createSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: qatarPhoneField(), // +974XXXXXXXX (Qatar mobile, obvious fakes refused)
    area: z.string().trim().max(80).optional(),
    zone: addressCode,
    street: addressCode,
    building: addressCode,
    address: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  items: z.array(z.object({
    productId: z.string().length(24),
    variantName: z.string().max(100).optional(),
    qty: z.number().int().min(1).max(MAX_LINE),
  })).min(1).max(30),
  offer: z.boolean().optional(), // the "leaving" discount (only works if you switched it on)
  source: z.enum(['website', 'whatsapp']).default('website'),
  utm: z.object({
    source: z.string().max(100).optional(), medium: z.string().max(100).optional(), campaign: z.string().max(150).optional(),
  }).optional(),
  attribution: z.object({
    source: txt, medium: txt, campaign: txt, content: txt, term: txt,
    campaignId: txt, adsetId: txt, adId: txt, fbclid: txt, ttclid: txt, fbp: txt, fbc: txt,
    landing: txt, referrer: txt, visitorId: txt,
    firstSeenAt: z.number().int().positive().optional(),
  }).optional(),
  angle: z.object({
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,29}$/),
    product: z.string().length(24).optional(),
  }).optional(),
  website: z.string().max(200).optional(), // hidden "honeypot" field: real people leave it empty
})

const r2 = (n) => Math.round(n * 100) / 100

// what is stored on the order (visitorId is stored on its own; dates become real dates)
function attributionOf(a) {
  if (!a) return undefined
  const { visitorId, firstSeenAt, ...rest } = a
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v))
  if (firstSeenAt) clean.firstSeenAt = new Date(firstSeenAt)
  return Object.keys(clean).length ? clean : undefined
}

// ---- public: place an order ----
router.post('/', orderLimiter, asyncHandler(async (req, res) => {
  // a clear answer for a wrong quantity (not a number, a decimal, below 1, above the line ceiling)
  if (Array.isArray(req.body?.items) && req.body.items.some((i) => !Number.isInteger(i?.qty) || i.qty < 1 || i.qty > MAX_LINE)) {
    throw httpError(400, 'Please choose a quantity of at least 1 piece.', 'يرجى اختيار كمية قطعة واحدة على الأقل.')
  }
  const data = createSchema.parse(req.body)
  if (data.website) return res.status(201).json({ orderNumber: 'NX-0000', total: 0 }) // bot: fake success

  const settings = (await Settings.findOne({ key: 'main' })) || {}
  const reserved = []
  const lines = []
  const notes = []
  let order

  try {
    const ids = [...new Set(data.items.map((i) => i.productId))]
    const products = await Product.find({ _id: { $in: ids }, isActive: true }).select('+costPrice +variants.cost')
    const byId = new Map(products.map((p) => [String(p._id), p]))

    // 1) check every line
    const rows = data.items.map((it) => {
      const product = byId.get(it.productId)
      if (!product) throw httpError(400, 'A product in your cart is no longer available', 'أحد المنتجات في سلتك لم يعد متوفراً')
      let variant = null
      if (product.variants.length) {
        variant = product.variants.find((v) => v.name === it.variantName)
        // products with option types: every type chosen, the pair exists and is switched on
        const bad = comboProblem(product, variant, it.variantName)
        if (bad) throw httpError(bad.status, bad.en, bad.ar)
        if (!variant) throw httpError(400, `Please choose an option for ${product.name.en}`, `يرجى اختيار خيار لـ ${product.name.ar || product.name.en}`)
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
    // "Maximum pieces per order" (Settings; 0 = only the stock limits it), per product, all its options together
    const perOrder = Number(settings.maxPerOrder ?? 10)
    if (perOrder > 0) {
      for (const [id, q] of Object.entries(allQty)) {
        if (q > perOrder) {
          const p = byId.get(id)
          throw httpError(400, `You can order at most ${perOrder} pieces of ${p.name.en} in one order.`,
            `يمكنك طلب ${perOrder} قطع كحد أقصى من ${p.name.ar || p.name.en} في الطلب الواحد.`)
        }
      }
    }
    const unitPrice = {}
    for (const [id, q] of Object.entries(pooledQty)) {
      const p = byId.get(id)
      unitPrice[id] = priceFor(q, p.price, p.packs) / q
    }

    // 3) reserve stock and build the order lines (price always comes from the database)
    for (const r of rows) {
      const id = String(r.product._id)
      if (!(await reserveStock(r.product._id, r.variant?.name, r.it.qty))) {
        const ar = comboDetails(r.product, r.variant).variantNameAr || r.variant?.name
        throw httpError(409, `Sorry, ${r.product.name.en}${r.variant ? ` (${r.variant.name})` : ''} is out of stock`,
          `عذراً، ${r.product.name.ar || r.product.name.en}${r.variant ? ` (${ar})` : ''} غير متوفر حالياً`)
      }
      reserved.push({ id: r.product._id, variantName: r.variant?.name, qty: r.it.qty })
      lines.push({
        product: r.product._id,
        name: r.product.name.en,
        variantName: r.variant?.name,
        ...comboDetails(r.product, r.variant), // options [{ type, value }] + Arabic name (products with option types)
        price: r.pooled ? unitPrice[id] : r.variant.price,
        // a combination with its own cost uses it; otherwise the product cost, exactly as before
        cost: ownCost(r.variant) ?? (r.product.costPrice || 0),
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

    // sales event label (display only: it is looked up after every price above is final and changes none of them)
    const live = await liveEvent().catch(() => null)

    // flags for you only (failed before / duplicate / blocked); the customer always gets the normal answer
    const flags = await orderFlags(data.customer.phone).catch(() => ({}))
    const hold = !!settings.holdFlagged && isFlagged(flags)

    order = await Order.create({
      event: live ? { id: live._id, name: live.name?.en } : undefined,
      customer: data.customer, items: lines, subtotal, discount, couponCode, deliveryFee,
      total: r2(afterDiscount + deliveryFee), shippingCost: Number(settings.shippingCostPerOrder) || 0,
      source: data.source, ip: req.ip,
      utm: data.utm || (data.attribution && {
        source: data.attribution.source, medium: data.attribution.medium, campaign: data.attribution.campaign,
      }),
      attribution: attributionOf(data.attribution),
      visitorId: data.attribution?.visitorId,
      // keep the angle only if its product is in this order
      angle: data.angle && (!data.angle.product || lines.some((l) => String(l.product) === data.angle.product))
        ? data.angle : undefined,
      adminNotes: notes.join('\n') || undefined,
      flags: { ...flags, held: hold },
      status: hold ? 'on_hold' : 'new',
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
  // popup switched off in Settings: share nothing about customers
  const s = await Settings.findOne({ key: 'main' }).select('salesPopup').lean()
  if (s?.salesPopup === false) {
    res.set('Cache-Control', 'public, max-age=60')
    return res.json([])
  }
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

// ---- admin: website orders placed after a moment (for the "new order" toasts) ----
// Without ?after it only returns the server time, so the admin starts from "now" and never shows
// toasts for older orders. Orders you register yourself (manual sources) are not included.
router.get('/new-since', protect, asyncHandler(async (req, res) => {
  const now = new Date()
  const after = req.query.after ? new Date(String(req.query.after)) : null
  if (!after || Number.isNaN(after.getTime())) return res.json({ now, items: [] })
  const orders = await Order.find({ source: 'website', createdAt: { $gt: after, $lte: now } })
    .sort({ createdAt: 1 }).limit(10)
    .select('orderNumber customer.name customer.zone customer.area items.name items.qty items.price createdAt flags status')
    .lean()
  const items = orders.map((o) => {
    const paid = o.items.filter((i) => i.price > 0)
    const names = [...new Set(paid.map((i) => i.name))]
    return {
      id: o._id,
      orderNumber: o.orderNumber,
      firstName: String(o.customer?.name || '').trim().split(/\s+/)[0],
      units: paid.reduce((n, i) => n + (i.qty || 0), 0),
      product: names[0] || o.items[0]?.name,
      more: Math.max(0, names.length - 1),
      zone: o.customer?.zone,
      area: o.customer?.area,
      createdAt: o.createdAt,
      flags: o.flags,
      held: o.status === 'on_hold',
    }
  })
  res.json({ now, items })
}))

// the filters of the admin order list (also used for the product counts); skipProduct leaves the product
// filter out, so the product dropdown can show how many orders each product has in the current view
function listFilter(query, { skipProduct = false } = {}) {
  const { status, q, from, to, zone, source, campaign, ad, angle, event, product, reason, flagged } = query
  const filter = {}
  if (status) {
    const list = String(status).split(',').filter((x) => ORDER_STATUSES.includes(x))
    if (list.length) filter.status = list.length === 1 ? list[0] : { $in: list }
  }
  if (zone) filter['customer.zone'] = String(zone).trim()
  if (source === 'website') filter.source = 'website'
  else if (source === 'other') filter.source = { $ne: 'website' }
  if (q) {
    const rx = new RegExp(String(q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ orderNumber: rx }, { 'customer.phone': rx }, { 'customer.name': rx }]
  }
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  const byAd = attributionFilter({ campaign, ad })
  if (byAd.length) filter.$and = byAd
  if (event && mongoose.isValidObjectId(event)) filter['event.id'] = event
  if (angle === 'none') filter['angle.slug'] = { $exists: false }
  else if (angle) filter['angle.slug'] = String(angle).toLowerCase()
  // failed-delivery reason ("any" = every failed order that has a reason)
  if (reason === 'any') filter['failure.reason'] = { $exists: true }
  else if (FAIL_REASONS.includes(String(reason))) filter['failure.reason'] = String(reason)
  if (flagged === '1') filter.$and = [...(filter.$and || []), FLAGGED]
  // orders that contain the product in any line (any variant, pack or free gift line)
  if (!skipProduct && product && mongoose.isValidObjectId(String(product))) {
    filter['items.product'] = new mongoose.Types.ObjectId(String(product))
  }
  return filter
}

router.get('/', protect, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const filter = listFilter(req.query)
  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('items.product', 'slug').lean(),
    Order.countDocuments(filter),
  ])
  res.json({ items: await withRealCost(items), total, page: p, pages: Math.ceil(total / l) })
}))

// all products for the "Product" filter, with the number of orders each one has under the other filters
router.get('/product-options', protect, asyncHandler(async (req, res) => {
  const [products, counts] = await Promise.all([
    Product.find({}).select('name images isActive').sort({ 'name.en': 1 }).limit(2000).lean(),
    Order.aggregate([
      { $match: listFilter(req.query, { skipProduct: true }) },
      { $project: { p: { $setUnion: [{ $ifNull: ['$items.product', []] }, []] } } }, // each product once per order
      { $unwind: '$p' },
      { $group: { _id: '$p', orders: { $sum: 1 } } },
    ]),
  ])
  const countOf = new Map(counts.map((c) => [String(c._id), c.orders]))
  res.json(products.map((p) => ({
    id: String(p._id),
    name: p.name?.en || p.name?.ar || '(no name)',
    nameAr: p.name?.ar || '',
    image: p.images?.[0]?.url || '',
    active: p.isActive !== false,
    orders: countOf.get(String(p._id)) || 0,
  })))
}))

// orders and revenue per ad (and the values for the campaign / ad filter)
router.get('/by-ad', protect, asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const orders = await Order.find({ createdAt: { $gte: since }, source: 'website' })
    .select('attribution utm total status').limit(20000).lean()

  const rows = new Map()
  for (const o of orders) {
    const k = adKeyOf(o)
    const id = [k.campaignId || k.campaign, k.adsetId || k.adset, k.adId || k.ad].join('|')
    const r = rows.get(id) || { ...k, orders: 0, delivered: 0, cancelled: 0, revenue: 0, deliveredRevenue: 0 }
    r.orders += 1
    if (o.status === 'delivered') { r.delivered += 1; r.deliveredRevenue += o.total || 0 }
    if (['cancelled', 'returned'].includes(o.status)) r.cancelled += 1
    else r.revenue += o.total || 0
    rows.set(id, r)
  }
  const list = [...rows.values()]
    .map((r) => ({ ...r, revenue: r2(r.revenue), deliveredRevenue: r2(r.deliveredRevenue), noAd: !r.campaign && !r.campaignId && !r.ad && !r.adId }))
    .sort((a, b) => b.revenue - a.revenue)
  res.json({ days, rows: list })
}))

// orders and revenue per ad angle (website orders)
router.get('/by-angle', protect, asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: since }, source: 'website' } },
    {
      $group: {
        _id: { slug: '$angle.slug', product: '$angle.product' },
        orders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 0, '$total'] } },
      },
    },
    { $sort: { revenue: -1 } },
  ])
  const names = await Product.find({ _id: { $in: rows.map((r) => r._id.product).filter(Boolean) } }).select('name').lean()
  const nameOf = Object.fromEntries(names.map((p) => [String(p._id), p.name?.en]))
  res.json({
    days,
    rows: rows.map((r) => ({
      slug: r._id.slug || null,
      product: r._id.product ? nameOf[String(r._id.product)] || 'Deleted product' : null,
      orders: r.orders, delivered: r.delivered, cancelled: r.cancelled, revenue: r2(r.revenue),
    })),
  })
}))

// several orders at once (packing slips and labels), at most 200
router.get('/by-ids', protect, asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter((id) => mongoose.isValidObjectId(id)).slice(0, 200)
  res.json(await Order.find({ _id: { $in: ids } }).lean())
}))

router.get('/:id', protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('items.product', 'slug').lean()
  if (!order) return res.status(404).json({ message: 'Order not found' })
  res.json(await withRealCost(order))
}))

// one status change (also used by the bulk change, so both behave the same)
//   opts.restock: when the order is closed (cancelled / failed), put its units back in stock (default yes)
//   opts.reason / opts.reasonNote: required for "Failed / returned"
// Units are never returned twice: order.stockReleased remembers whether they are back in stock.
const CLOSED = ['cancelled', 'returned']
const releasedNow = (o) => o.stockReleased ?? (CLOSED.includes(o.status) && o.stockTaken !== false) // older orders
export async function applyStatus(order, status, note, opts = {}) {
  const { restock = true, reason, reasonNote, by } = opts
  if (status === 'returned' && !FAIL_REASONS.includes(reason)) throw httpError(400, 'Choose why the delivery failed')
  const released = releasedNow(order)
  const toClosed = CLOSED.includes(status)

  if (toClosed && order.stockTaken !== false && !released && restock) {
    for (const it of order.items) if (it.product) await releaseStock(it.product, it.variantName, it.qty) // put items back
    order.stockReleased = true
  }
  // re-opening an order whose units went back to stock: take them again
  // (all or nothing; if something is no longer in stock the status is not changed)
  if (!toClosed && order.stockTaken !== false && released) {
    const taken = []
    for (const it of order.items) {
      if (!it.product) continue
      if (!(await reserveStock(it.product, it.variantName, it.qty))) {
        for (const t of taken) await releaseStock(t.product, t.variantName, t.qty)
        throw httpError(409, `Not enough stock to re-open ${order.orderNumber}: ${it.name}${it.variantName ? ` (${it.variantName})` : ''}`)
      }
      taken.push(it)
    }
    order.stockReleased = false
  }
  if (toClosed && order.stockReleased === undefined) order.stockReleased = released

  if (status === 'returned') {
    order.failure = {
      reason, note: reasonNote ? String(reasonNote).slice(0, 300) : undefined,
      at: new Date(), by, restocked: !!order.stockReleased,
    }
  } else if (order.status === 'returned') {
    order.failure = undefined // no longer a failed delivery (the history keeps the old reason)
  }
  const label = status === 'returned' ? `Failed: ${reason}${reasonNote ? ` (${String(reasonNote).slice(0, 120)})` : ''}` : undefined
  order.status = status
  order.deliveredAt = status === 'delivered' ? new Date() : undefined
  order.statusHistory.push({ status, note: [note, label].filter(Boolean).join(' · ') || undefined, by })
  await order.save()
}

const statusBody = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(300).optional(),
  reason: z.enum(FAIL_REASONS).optional(),
  reasonNote: z.string().trim().max(300).optional(),
  restock: z.boolean().default(true),
})
const whoOf = (req) => req.admin?.name || req.admin?.email || 'admin'

// change the status of several orders at once (one failed reason for all)
router.patch('/bulk-status', protect, asyncHandler(async (req, res) => {
  const { ids } = req.body
  const body = statusBody.parse(req.body)
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) throw httpError(400, 'Choose between 1 and 200 orders')
  if (body.status === 'returned' && !body.reason) throw httpError(400, 'Choose why the delivery failed')
  const valid = ids.map(String).filter((id) => mongoose.isValidObjectId(id))
  const orders = await Order.find({ _id: { $in: valid } })
  let changed = 0
  const failed = []
  for (const order of orders) {
    if (order.status === body.status) continue
    try {
      await applyStatus(order, body.status, body.note || 'Bulk change', { ...body, by: whoOf(req) })
      changed += 1
    } catch (e) {
      if (e.status !== 409) throw e
      failed.push(e.message)
    }
  }
  res.json({ changed, skipped: orders.length - changed - failed.length, failed })
}))

router.patch('/:id/status', protect, asyncHandler(async (req, res) => {
  const body = statusBody.parse(req.body)
  const order = await Order.findById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found' })

  await applyStatus(order, body.status, body.note, { ...body, by: whoOf(req) })
  await order.populate('items.product', 'slug')
  res.json(await withRealCost(order.toObject()))
}))

router.patch('/:id/notes', protect, asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id, { adminNotes: String(req.body.adminNotes || '') }, { returnDocument: 'after' })
  if (!order) return res.status(404).json({ message: 'Order not found' })
  await order.populate('items.product', 'slug')
  res.json(await withRealCost(order.toObject()))
}))

// what delivery cost you for this order
router.patch('/:id/costs', protect, asyncHandler(async (req, res) => {
  const shippingCost = Number(req.body.shippingCost)
  if (!Number.isFinite(shippingCost) || shippingCost < 0) throw httpError(400, 'Invalid shipping cost')
  const order = await Order.findByIdAndUpdate(req.params.id, { shippingCost }, { returnDocument: 'after' })
  if (!order) return res.status(404).json({ message: 'Order not found' })
  await order.populate('items.product', 'slug')
  res.json(await withRealCost(order.toObject()))
}))

export default router