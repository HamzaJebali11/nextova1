import express, { Router } from 'express'
import { z } from 'zod'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import Visit from './stats.model.js'
import LiveVisitor from './live.model.js'
import Order from '../orders/order.model.js'
import Product from '../products/product.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const OFFSET = 3 * 60 * 60 * 1000 // Qatar time
const DAY = 24 * 60 * 60 * 1000
const keyToMs = (k) => Date.parse(`${k}T00:00:00Z`)
const msToKey = (ms) => new Date(ms).toISOString().slice(0, 10)
const qDay = () => msToKey(Date.now() + OFFSET)
const addDays = (k, n) => msToKey(keyToMs(k) + n * DAY)

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 300 })

const hitSchema = z.object({
  visitorId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9-]+$/),
  path: z.string().max(300),
  utm: z.object({
    source: z.string().max(60).optional(),
    medium: z.string().max(60).optional(),
    campaign: z.string().max(100).optional(),
  }).optional(),
  referrer: z.string().max(100).optional(),
})

// ---- public: a page was opened ----
router.post('/hit', limiter, async (req, res) => {
  try {
    const ua = req.get('user-agent') || ''
    if (BOT.test(ua)) return res.sendStatus(204)
    const data = hitSchema.parse(req.body)
    if (data.path.startsWith('/admin')) return res.sendStatus(204)

    const source = data.utm?.source
      ? `${data.utm.source}${data.utm.medium ? ` / ${data.utm.medium}` : ''}`
      : data.referrer || 'direct'
    const slug = data.path.startsWith('/product/') ? data.path.split('/')[2] : null

    const update = {
      $inc: { pageViews: 1 },
      $setOnInsert: {
        landing: data.path.slice(0, 100),
        source,
        campaign: data.utm?.campaign,
        device: /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop',
        createdAt: new Date(),
      },
    }
    if (slug) update.$addToSet = { products: slug }

    await Visit.updateOne({ day: qDay(), visitorId: data.visitorId }, update, { upsert: true })
  } catch {
    // counting must never cause an error for the visitor
  }
  res.sendStatus(204)
})

// ---- admin: the numbers ----
router.get('/visitors', protect, asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30))
  const today = qDay()
  const from = addDays(today, -(days - 1))

  const uniqueSince = async (fromDay) => {
    const [r] = await Visit.aggregate([
      { $match: { day: { $gte: fromDay } } },
      { $group: { _id: '$visitorId' } },
      { $count: 'n' },
    ])
    return r?.n || 0
  }

  const [perDay, sources, productHits, orderRows, last7, range, devices, sourceOrders] = await Promise.all([
    Visit.aggregate([
      { $match: { day: { $gte: from } } },
      { $group: { _id: '$day', visitors: { $sum: 1 }, pageViews: { $sum: '$pageViews' } } },
    ]),
    Visit.aggregate([
      { $match: { day: { $gte: from } } },
      { $group: { _id: '$source', visitors: { $sum: 1 } } },
      { $sort: { visitors: -1 } },
      { $limit: 10 },
    ]),
    Visit.aggregate([
      { $match: { day: { $gte: from } } },
      { $unwind: '$products' },
      { $group: { _id: '$products', visitors: { $sum: 1 } } },
      { $sort: { visitors: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: { source: 'website', createdAt: { $gte: new Date(`${from}T00:00:00+03:00`) } } },      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Qatar' } },
          orders: { $sum: 1 },
        },
      },
    ]),
    uniqueSince(addDays(today, -6)),
    uniqueSince(from),
    Visit.aggregate([
      { $match: { day: { $gte: from } } },
      { $group: { _id: '$device', visitors: { $sum: 1 } } },
    ]),
    Order.find({ source: 'website', createdAt: { $gte: new Date(`${from}T00:00:00+03:00`) } })
      .select('utm attribution total status').limit(20000).lean(),
  ])

  // orders per source, labelled the same way as visits ("facebook / paid", a referrer, or "direct")
  const sourceOf = (o) => {
    const a = o.attribution || {}
    const src = a.source || o.utm?.source
    const med = a.medium || o.utm?.medium
    if (src) return `${src}${med ? ` / ${med}` : ''}`
    if (a.referrer) return a.referrer
    return o.attribution ? 'direct' : 'unknown (order before tracking)'
  }
  const ordersBySource = {}
  for (const o of sourceOrders) {
    const k = sourceOf(o)
    const t = (ordersBySource[k] ||= { orders: 0, revenue: 0 })
    t.orders += 1
    if (!['cancelled', 'returned'].includes(o.status)) t.revenue += o.total || 0
  }

  const byDay = Object.fromEntries(perDay.map((d) => [d._id, d]))
  const ordersByDay = Object.fromEntries(orderRows.map((o) => [o._id, o.orders]))
  const series = []
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i)
    series.push({
      day,
      visitors: byDay[day]?.visitors || 0,
      pageViews: byDay[day]?.pageViews || 0,
      orders: ordersByDay[day] || 0,
    })
  }

  const slugs = productHits.map((p) => p._id)
  const names = await Product.find({ slug: { $in: slugs } }).select('name slug').lean()
  const nameOf = Object.fromEntries(names.map((p) => [p.slug, p.name?.en]))

  const orders = series.reduce((s, d) => s + d.orders, 0)
  res.json({
    days,
    series,
    totals: {
      today: series[series.length - 1].visitors,
      yesterday: series.length > 1 ? series[series.length - 2].visitors : 0,
      last7,
      range,
      pageViews: series.reduce((s, d) => s + d.pageViews, 0),
      orders,
      conversion: range ? Math.round((orders / range) * 1000) / 10 : 0,
    },
    sources: [
      ...sources.map((s) => {
        const name = s._id || 'direct'
        const o = ordersBySource[name] || { orders: 0, revenue: 0 }
        return {
          name,
          visitors: s.visitors,
          orders: o.orders,
          revenue: Math.round(o.revenue * 100) / 100,
          conversion: s.visitors ? Math.round((o.orders / s.visitors) * 1000) / 10 : 0,
        }
      }),
      // order sources with no visits in the top list (for example orders placed before tracking)
      ...Object.entries(ordersBySource)
        .filter(([name]) => !sources.some((s) => (s._id || 'direct') === name))
        .map(([name, o]) => ({ name, visitors: 0, orders: o.orders, revenue: Math.round(o.revenue * 100) / 100, conversion: null })),
    ],
    devices: devices.map((d) => ({ name: d._id || 'unknown', visitors: d.visitors })),
    products: productHits.map((p) => ({ slug: p._id, name: nameOf[p._id] || p._id, visitors: p.visitors })),
  })
}))

// ======================= LIVE VISITORS (Step 42) =======================
// A live visitor = an anonymous visitor whose heartbeat arrived in the last 5 minutes.
// (LIVE_WINDOW_SECONDS only shortens this window for local tests; it is not set in production.)
const liveWindowMs = () => (Number(process.env.LIVE_WINDOW_SECONDS) > 0 ? Number(process.env.LIVE_WINDOW_SECONDS) : 300) * 1000

// the collection and its TTL index are created on the first heartbeat only (never at server start)
let liveReady = null
const ensureLive = () => (liveReady ||= LiveVisitor.createIndexes().catch((e) => { liveReady = null; throw e }))

const liveSchema = z.object({
  visitorId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9-]+$/),
  page: z.enum(['home', 'shop', 'category', 'product', 'cart', 'checkout', 'confirmation', 'other']),
  productId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  device: z.enum(['phone', 'tablet', 'desktop']),
}).strict() // any other field (name, phone, ...) is refused

// about 6 heartbeats a minute per visitor (one every 30 s is normal), on top of the general API limit
const liveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const v = req.body?.visitorId
    return typeof v === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(v) ? `v:${v}` : ipKeyGenerator(req.ip)
  },
  message: { message: 'Too many requests' },
})
const LIVE_MAX_BYTES = 512

// ---- public: heartbeat (page load + every 30 s while the tab is visible) ----
// Sent as text/plain (a "simple" request: no extra CORS preflight round trip on phones); JSON is accepted too.
router.post('/live', (req, res, next) => {
  // small payload only (the body is a few short fields)
  if (Number(req.get('content-length') || 0) > LIVE_MAX_BYTES || (req.rawBody && req.rawBody.length > LIVE_MAX_BYTES)) {
    return res.status(413).json({ message: 'Too large' })
  }
  next()
}, express.text({ type: 'text/plain', limit: LIVE_MAX_BYTES }), (req, res, next) => {
  if (typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body) } catch { return res.status(400).json({ message: 'Invalid heartbeat' }) }
  }
  next()
}, liveLimiter, asyncHandler(async (req, res) => {
  // bots, and any request that carries the admin login, are not counted
  if (BOT.test(req.get('user-agent') || '') || req.get('authorization')) return res.sendStatus(204)
  const parsed = liveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid heartbeat' })
  const d = parsed.data
  await ensureLive()
  await LiveVisitor.updateOne(
    { _id: d.visitorId },
    { $set: { page: d.page, device: d.device, lastSeen: new Date(), product: d.page === 'product' && d.productId ? d.productId : null } },
    { upsert: true },
  )
  res.sendStatus(204)
}))

// ---- admin: who is on the site right now (cached 5 s for all admin tabs) ----
let liveCache = { at: 0, value: null }
router.get('/live', protect, asyncHandler(async (req, res) => {
  const now = Date.now()
  if (!liveCache.value || now - liveCache.at > 5000) {
    const list = await LiveVisitor.find({ lastSeen: { $gte: new Date(now - liveWindowMs()) } }).select('page device product').lean()
    const byPage = { home: 0, shop: 0, category: 0, product: 0, cart: 0, checkout: 0, confirmation: 0, other: 0 }
    const byDevice = { phone: 0, tablet: 0, desktop: 0 }
    const views = new Map()
    for (const v of list) {
      if (v.page in byPage) byPage[v.page]++
      if (v.device in byDevice) byDevice[v.device]++
      if (v.page === 'product' && v.product) views.set(String(v.product), (views.get(String(v.product)) || 0) + 1)
    }
    const topIds = [...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const names = new Map((await Product.find({ _id: { $in: topIds.map(([id]) => id) } }).select('name slug').lean()).map((p) => [String(p._id), p]))
    liveCache = {
      at: now,
      value: {
        total: list.length,
        byPage,
        byDevice,
        top: topIds.map(([id, count]) => ({ id, name: names.get(id)?.name || { en: '(deleted product)' }, slug: names.get(id)?.slug, count })),
        windowSeconds: liveWindowMs() / 1000,
      },
    }
  }
  res.set('Cache-Control', 'no-store')
  res.json({ ...liveCache.value, at: new Date(liveCache.at).toISOString() })
}))

export default router