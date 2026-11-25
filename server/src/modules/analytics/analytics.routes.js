import { Router } from 'express'
import Order from '../orders/order.model.js'
import Product from '../products/product.model.js'
import AdSpend from '../adspend/adspend.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'
import { realCostMap, lineCostParts } from '../../utils/realCost.js'

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

// cogs   = base cost of the units delivered
// adCost = ad spend of the product spread per unit (the "ads" part of the real cost per unit)
// ads    = general ad spend that is not linked to a product, spread over its days
// profit = revenue - (cogs + adCost) - shipping - ads   (cogs + adCost = units x real cost per unit)
const blank = () => ({ placed: 0, delivered: 0, revenue: 0, cogs: 0, adCost: 0, shipping: 0, ads: 0 })
const finish = (o) => ({
  placed: o.placed,
  delivered: o.delivered,
  revenue: r2(o.revenue),
  cogs: r2(o.cogs),
  adCost: r2(o.adCost),
  shipping: r2(o.shipping),
  ads: r2(o.ads),
  profit: r2(o.revenue - o.cogs - o.adCost - o.shipping - o.ads),
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

// first day of the previous period of the same length (for the +/- % comparison)
function previousStart(period, firstKey) {
  if (period === 'week') return addDays(firstKey, -84)
  if (period === 'month') {
    const [y, m] = firstKey.split('-').map(Number)
    return msToKey(Date.UTC(y, m - 1 - 12, 1))
  }
  return addDays(firstKey, -30)
}

const keyFnFor = (period) => (period === 'week' ? weekStart : period === 'month' ? monthStart : (k) => k)

router.get('/', protect, asyncHandler(async (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day'
  const today = todayKey()
  const keys = bucketKeys(period, today)
  const keyFn = keyFnFor(period)

  const monthStartKey = monthStart(today)
  const prevKey = previousStart(period, keys[0])
  const sinceKey = prevKey < monthStartKey ? prevKey : monthStartKey
  const since = new Date(keyToMs(sinceKey) - OFFSET)
  const rangeStart = new Date(keyToMs(keys[0]) - OFFSET)

  const [placed, deliveredOrders, inProg, missingCost, ads] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, orders: { $sum: 1 } } },
    ]),
    Order.find({ status: 'delivered', $or: [{ deliveredAt: { $gte: since } }, { deliveredAt: null, updatedAt: { $gte: since } }] })
      .select('total shippingCost deliveredAt updatedAt items.product items.name items.qty items.price items.cost')
      .limit(50000).lean(),
    Order.aggregate([
      { $match: { status: { $in: ['new', 'confirmed', 'processing', 'out_for_delivery'] } } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$total' } } },
    ]),
    Product.countDocuments({ isActive: true, $or: [{ costPrice: { $exists: false } }, { costPrice: { $lte: 0 } }] }),
    AdSpend.find().lean(),
  ])

  // today's real cost per unit of every product in these orders
  const costs = await realCostMap(deliveredOrders.flatMap((o) => o.items.map((i) => i.product)).filter(Boolean))

  // delivered orders per day, costed with the real cost per unit; best products in the chart range
  const delivered = new Map()
  const top = new Map()
  for (const o of deliveredOrders) {
    const k = dayKey(o.deliveredAt || o.updatedAt)
    const d = delivered.get(k) || { orders: 0, revenue: 0, shipping: 0, cogs: 0, adCost: 0 }
    d.orders += 1
    d.revenue += o.total || 0
    d.shipping += o.shippingCost || 0
    for (const it of o.items) {
      const part = lineCostParts(it, costs)
      d.cogs += part.base
      d.adCost += part.ad
      if (new Date(o.deliveredAt || o.updatedAt) >= rangeStart) {
        const id = String(it.product || it.name)
        const t = top.get(id) || { id: it.product, name: it.name?.replace(/ \(free gift\)$/, ''), units: 0, revenue: 0, cogs: 0, adCost: 0 }
        t.units += it.price > 0 ? it.qty : 0
        t.revenue += (it.price || 0) * it.qty
        t.cogs += part.base
        t.adCost += part.ad
        top.set(id, t)
      }
    }
    delivered.set(k, d)
  }
  const topProducts = [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // spread each GENERAL ad entry (not linked to a product) evenly over the days it covers.
  // Product ad entries are already inside the real cost per unit, so they are not counted again here.
  const adByDay = {}
  for (const a of ads) {
    if (a.product) continue
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
  delivered.forEach((p, k) => {
    const d = daily.get(k)
    if (d) { d.delivered += p.orders; d.revenue += p.revenue; d.cogs += p.cogs; d.adCost += p.adCost; d.shipping += p.shipping }
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

  const sumFrom = (fromKey, beforeKey = '9999-12-31') => {
    const t = blank()
    for (const [k, v] of daily) if (k >= fromKey && k < beforeKey) for (const f of Object.keys(t)) t[f] += v[f]
    return finish(t)
  }

  res.json({
    period,
    buckets,
    // totals of the chart range and of the period of the same length just before it
    current: sumFrom(keys[0]),
    previous: sumFrom(prevKey, keys[0]),
    kpis: { today: sumFrom(today), week: sumFrom(weekStart(today)), month: sumFrom(monthStartKey) },
    inProgress: inProg[0] ? { count: inProg[0].count, value: inProg[0].value } : { count: 0, value: 0 },
    missingCost,
    products: topProducts.map((p) => ({
      id: p.id, name: p.name, units: p.units, revenue: r2(p.revenue), cogs: r2(p.cogs), adCost: r2(p.adCost),
      profit: r2(p.revenue - p.cogs - p.adCost),
    })),
  })
}))

export default router