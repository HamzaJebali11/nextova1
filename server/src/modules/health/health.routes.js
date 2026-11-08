import { Router } from 'express'
import Order from '../orders/order.model.js'
import Visit from '../stats/stats.model.js'
import Lead from '../leads/lead.model.js'
import Product from '../products/product.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const OFFSET = 3 * 60 * 60 * 1000 // Qatar is UTC+3
const DAY = 24 * 60 * 60 * 1000
const msToKey = (ms) => new Date(ms).toISOString().slice(0, 10)
const qDay = () => msToKey(Date.now() + OFFSET)
const addDays = (k, n) => msToKey(Date.parse(`${k}T00:00:00Z`) + n * DAY)
const r1 = (n) => Math.round(n * 10) / 10
const r2 = (n) => Math.round(n * 100) / 100
const pct = (a, b) => (b ? r1((a / b) * 100) : null)
const FAIL = ['returned', 'cancelled']

function summarize(list) {
  const s = { placed: list.length, delivered: 0, returned: 0, cancelled: 0, open: 0, revenue: 0 }
  for (const o of list) {
    if (o.status === 'delivered') { s.delivered += 1; s.revenue += o.total || 0 }
    else if (o.status === 'returned') s.returned += 1
    else if (o.status === 'cancelled') s.cancelled += 1
    else s.open += 1
  }
  const closed = s.delivered + s.returned + s.cancelled
  return {
    ...s,
    revenue: r2(s.revenue),
    deliveryRate: pct(s.delivered, closed),
    failRate: pct(s.returned + s.cancelled, closed),
  }
}

function groupBy(orders, keyOf, limit = 15) {
  const map = new Map()
  for (const o of orders) {
    const k = keyOf(o)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(o)
  }
  return [...map]
    .map(([name, list]) => ({ name, ...summarize(list) }))
    .sort((a, b) => b.placed - a.placed)
    .slice(0, limit)
}

async function uniqueVisitors(match) {
  const [r] = await Visit.aggregate([{ $match: match }, { $group: { _id: '$visitorId' } }, { $count: 'n' }])
  return r?.n || 0
}

router.get('/', protect, asyncHandler(async (req, res) => {
  const days = Math.min(180, Math.max(7, Number(req.query.days) || 30))
  const fromKey = addDays(qDay(), -(days - 1))
  const from = new Date(`${fromKey}T00:00:00+03:00`)

  const orders = await Order.find({ createdAt: { $gte: from } })
    .select('status source utm customer.area customer.phone total createdAt deliveredAt')
    .limit(20000).lean()

  const [visitors, viewers, unfinished] = await Promise.all([
    uniqueVisitors({ day: { $gte: fromKey } }),
    uniqueVisitors({ day: { $gte: fromKey }, 'products.0': { $exists: true } }),
    Lead.countDocuments({ status: { $in: ['new', 'contacted'] }, updatedAt: { $gte: from } }),
  ])

  const websiteOrders = orders.filter((o) => o.source === 'website').length

  // customers who had ordered before this period
  const phones = [...new Set(orders.map((o) => o.customer?.phone).filter((p) => p && p !== 'N/A'))]
  const earlier = phones.length
    ? await Order.distinct('customer.phone', { createdAt: { $lt: from }, 'customer.phone': { $in: phones } })
    : []

  const valid = orders.filter((o) => !FAIL.includes(o.status))
  const aov = valid.length ? r2(valid.reduce((s, o) => s + (o.total || 0), 0) / valid.length) : 0

  const hours = orders
    .filter((o) => o.status === 'delivered' && o.deliveredAt)
    .map((o) => (new Date(o.deliveredAt) - new Date(o.createdAt)) / 36e5)
  const avgDeliveryHours = hours.length ? r1(hours.reduce((a, b) => a + b, 0) / hours.length) : null

  const byHour = Array(24).fill(0)
  const byWeekday = Array(7).fill(0)
  for (const o of orders) {
    const d = new Date(new Date(o.createdAt).getTime() + OFFSET)
    byHour[d.getUTCHours()] += 1
    byWeekday[d.getUTCDay()] += 1
  }

  const campaignOf = (o) =>
    o.utm?.campaign ||
    (o.source === 'website'
      ? o.utm?.source ? `${o.utm.source} (no campaign)` : 'Website (no ad)'
      : `Manual: ${o.source}`)

  // products that will run out soon, at their speed of the last 14 days
  const [soldRows, products] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 14 * DAY) }, status: { $nin: FAIL } } },
      { $unwind: '$items' },
      { $match: { 'items.price': { $gt: 0 } } },
      { $group: { _id: '$items.product', units: { $sum: '$items.qty' } } },
    ]),
    Product.find({ isActive: true }).select('name stock').lean(),
  ])
  const sold = Object.fromEntries(soldRows.map((s) => [String(s._id), s.units]))
  const stockRisk = products
    .map((p) => {
      const perDay = (sold[String(p._id)] || 0) / 14
      return { name: p.name?.en, stock: p.stock, perDay: r2(perDay), daysLeft: perDay > 0 ? Math.floor(p.stock / perDay) : null }
    })
    .filter((p) => p.stock <= 0 || (p.daysLeft !== null && p.daysLeft <= 10))
    .sort((a, b) => (a.stock <= 0 ? -1 : a.daysLeft) - (b.stock <= 0 ? -1 : b.daysLeft))

  res.json({
    days,
    funnel: { visitors, viewers, websiteOrders, unfinished },
    pipeline: summarize(orders),
    aov,
    avgDeliveryHours,
    returning: { customers: phones.length, returning: earlier.length, rate: pct(earlier.length, phones.length) },
    byCampaign: groupBy(orders, campaignOf),
    byArea: groupBy(orders, (o) => o.customer?.area || 'Unknown', 12),
    byHour,
    byWeekday,
    stockRisk,
  })
}))

export default router