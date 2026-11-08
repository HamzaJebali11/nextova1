import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import Visit from './stats.model.js'
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

  const [perDay, sources, productHits, orderRows, last7, range] = await Promise.all([
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
  ])

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
    sources: sources.map((s) => ({ name: s._id || 'direct', visitors: s.visitors })),
    products: productHits.map((p) => ({ slug: p._id, name: nameOf[p._id] || p._id, visitors: p.visitors })),
  })
}))

export default router