import { Router } from 'express'
import Order from '../orders/order.model.js'
import Product from '../products/product.model.js'
import AdSpend from '../adspend/adspend.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const TZ = 'Asia/Qatar' // Qatar is UTC+3 all year
const OFFSET = 3 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

const keyToMs = (k) => Date.parse(`${k}T00:00:00Z`)
const msToKey = (ms) => new Date(ms).toISOString().slice(0, 10)
const dayKey = (date) => msToKey(new Date(date).getTime() + OFFSET)
const todayKey = () => dayKey(Date.now())
const addDays = (k, n) => msToKey(keyToMs(k) + n * DAY)
const weekStart = (k) => addDays(k, -((new Date(keyToMs(k)).getUTCDay() + 6) % 7)) // Monday
const monthStart = (k) => `${k.slice(0, 7)}-01`
const r2 = (n) => Math.round(n * 100) / 100

const blank = () => ({ placed: 0, delivered: 0, revenue: 0, cogs: 0, shipping: 0, ads: 0 })
const finish = (o) => ({
  placed: o.placed,
  delivered: o.delivered,
  revenue: r2(o.revenue),
  cogs: r2(o.cogs),
  shipping: r2(o.shipping),
  ads: r2(o.ads),
  profit: r2(o.revenue - o.cogs - o.shipping - o.ads),
})

function bucketKeys(period, today) {
  const keys = []
  if (period === 'week') {
    const w = weekStart(today)
    for (let i = 11; i >= 0; i--) keys.push(addDays(w, -7 * i))
  } else if (period === 'month') {
    const [y, m] = today.split('-').map(Number)
    for (let i = 11; i >= 0; i--) keys.push(msToKey(Date.UTC(y, m - 1 - i, 1)))
  } else {
    for (let i = 29; i >= 0; i--) keys.push(addDays(today, -i))
  }
  return keys
}

const keyFnFor = (period) => (period === 'week' ? weekStart : period === 'month' ? monthStart : (k) => k)

router.get('/', protect, asyncHandler(async (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day'
  const today = todayKey()
  const keys = bucketKeys(period, today)
  const keyFn = keyFnFor(period)

  const monthStartKey = monthStart(today)
  const sinceKey = keys[0] < monthStartKey ? keys[0] : monthStartKey
  const since = new Date(keyToMs(sinceKey) - OFFSET)
  const rangeStart = new Date(keyToMs(keys[0]) - OFFSET)

  const doneAt = { $ifNull: ['$deliveredAt', '$updatedAt'] }

  const [placed, delivered, inProg, missingCost, topProducts, ads] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { status: 'delivered' } },
      { $addFields: { doneAt } },
      { $match: { doneAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$doneAt', timezone: TZ } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          shipping: { $sum: { $ifNull: ['$shippingCost', 0] } },
          cogs: {
            $sum: {
              $reduce: {
                input: '$items', initialValue: 0,
                in: { $add: ['$$value', { $multiply: [{ $ifNull: ['$$this.cost', 0] }, '$$this.qty'] }] },
              },
            },
          },
        },
      },
    ]),
    Order.aggregate([
      { $match: { status: { $in: ['new', 'confirmed', 'processing', 'out_for_delivery'] } } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$total' } } },
    ]),
    Product.countDocuments({ isActive: true, $or: [{ costPrice: { $exists: false } }, { costPrice: { $lte: 0 } }] }),
    Order.aggregate([
      { $match: { status: 'delivered' } },
      { $addFields: { doneAt } },
      { $match: { doneAt: { $gte: rangeStart } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          units: { $sum: '$items.qty' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          cogs: { $sum: { $multiply: [{ $ifNull: ['$items.cost', 0] }, '$items.qty'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
    AdSpend.find().lean(),
  ])

  // spread each ad entry evenly over the days it covers
  const adByDay = {}
  for (const a of ads) {
    const start = dayKey(a.startDate)
    const per = a.amount / a.days
    for (let i = 0; i < a.days; i++) {
      const k = addDays(start, i)
      adByDay[k] = (adByDay[k] || 0) + per
    }
  }

  const daily = new Map()
  for (let k = sinceKey; k <= today; k = addDays(k, 1)) daily.set(k, blank())
  placed.forEach((p) => { const d = daily.get(p._id); if (d) d.placed += p.orders })
  delivered.forEach((p) => {
    const d = daily.get(p._id)
    if (d) { d.delivered += p.orders; d.revenue += p.revenue; d.cogs += p.cogs; d.shipping += p.shipping }
  })
  Object.entries(adByDay).forEach(([k, v]) => { const d = daily.get(k); if (d) d.ads += v })

  const rolled = new Map()
  for (const [k, v] of daily) {
    const b = keyFn(k)
    const t = rolled.get(b) || blank()
    for (const f of Object.keys(t)) t[f] += v[f]
    rolled.set(b, t)
  }
  const buckets = keys.map((key) => ({ key, ...finish(rolled.get(key) || blank()) }))

  const sumFrom = (fromKey) => {
    const t = blank()
    for (const [k, v] of daily) if (k >= fromKey) for (const f of Object.keys(t)) t[f] += v[f]
    return finish(t)
  }

  res.json({
    period,
    buckets,
    kpis: { today: sumFrom(today), week: sumFrom(weekStart(today)), month: sumFrom(monthStartKey) },
    inProgress: inProg[0] ? { count: inProg[0].count, value: inProg[0].value } : { count: 0, value: 0 },
    missingCost,
    products: topProducts.map((p) => ({
      id: p._id, name: p.name, units: p.units, revenue: r2(p.revenue), cogs: r2(p.cogs),
    })),
  })
}))

export default router