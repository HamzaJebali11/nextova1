import { Router } from 'express'
import mongoose from 'mongoose'
import AdSpend from './adspend.model.js'
import Order from '../orders/order.model.js'
import Product from '../products/product.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

const router = Router()
router.use(protect)

const OFFSET = 3 * 60 * 60 * 1000 // Qatar is UTC+3
const DAY = 24 * 60 * 60 * 1000
const keyToMs = (k) => Date.parse(`${k}T00:00:00Z`)
const msToKey = (ms) => new Date(ms).toISOString().slice(0, 10)
const qDay = () => msToKey(Date.now() + OFFSET)
const addDays = (k, n) => msToKey(keyToMs(k) + n * DAY)
const r2 = (n) => Math.round(n * 100) / 100

router.get('/', asyncHandler(async (req, res) => {
  res.json(await AdSpend.find().sort({ startDate: -1 }).limit(200).populate('product', 'name').lean())
}))

// ad cost and results per product, for the last N days
router.get('/by-product', asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30))
  const today = qDay()
  const from = addDays(today, -(days - 1))

  // each ad entry is spread evenly over the days it covers
  const entries = await AdSpend.find().lean()
  const spend = {}
  let unassigned = 0
  for (const a of entries) {
    const start = msToKey(new Date(a.startDate).getTime() + OFFSET)
    const per = a.amount / a.days
    for (let i = 0; i < a.days; i++) {
      const k = addDays(start, i)
      if (k < from || k > today) continue
      if (a.product) spend[String(a.product)] = (spend[String(a.product)] || 0) + per
      else unassigned += per
    }
  }

  // paid units sold in the period (orders that are not cancelled or returned; free gifts are not counted)
  const sales = await Order.aggregate([
    { $match: { createdAt: { $gte: new Date(`${from}T00:00:00+03:00`) }, status: { $nin: ['cancelled', 'returned'] } } },
    { $unwind: '$items' },
    { $match: { 'items.price': { $gt: 0 } } },
    {
      $group: {
        _id: '$items.product',
        units: { $sum: '$items.qty' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        cogs: { $sum: { $multiply: [{ $ifNull: ['$items.cost', 0] }, '$items.qty'] } },
        orderIds: { $addToSet: '$_id' },
      },
    },
  ])

  const byProduct = Object.fromEntries(sales.map((s) => [String(s._id), s]))
  const ids = [...new Set([...Object.keys(spend), ...Object.keys(byProduct)])].filter((id) => mongoose.isValidObjectId(id))
  const names = await Product.find({ _id: { $in: ids } }).select('name').lean()
  const nameOf = Object.fromEntries(names.map((p) => [String(p._id), p.name?.en]))

  const rows = ids.map((id) => {
    const s = byProduct[id]
    const ad = spend[id] || 0
    const units = s?.units || 0
    const orders = s?.orderIds?.length || 0
    const revenue = s?.revenue || 0
    const cogs = s?.cogs || 0
    const profit = revenue - cogs - ad
    return {
      id,
      name: nameOf[id] || 'Deleted product',
      spend: r2(ad),
      units,
      orders,
      revenue: r2(revenue),
      cogs: r2(cogs),
      adPerUnit: units ? r2(ad / units) : null,
      adPerOrder: orders ? r2(ad / orders) : null,
      profit: r2(profit),
      profitPerUnit: units ? r2(profit / units) : null,
    }
  }).sort((a, b) => b.spend - a.spend || b.revenue - a.revenue)

  res.json({ days, rows, unassigned: r2(unassigned) })
}))

router.post('/', asyncHandler(async (req, res) => {
  const { startDate, days = 7, amount, platform, note, product } = req.body
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate))) throw httpError(400, 'Choose a start date')
  const amt = Number(amount)
  const d = Math.round(Number(days))
  if (!Number.isFinite(amt) || amt < 0) throw httpError(400, 'Enter a valid amount')
  if (!Number.isFinite(d) || d < 1 || d > 366) throw httpError(400, 'Days must be between 1 and 366')
  if (product && !mongoose.isValidObjectId(product)) throw httpError(400, 'Invalid product')

  const doc = await AdSpend.create({
    startDate: new Date(`${startDate}T00:00:00+03:00`), // Qatar midnight
    days: d, amount: amt, platform, note, product: product || undefined,
  })
  res.status(201).json(doc)
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await AdSpend.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Entry not found' })
  res.json({ message: 'Deleted' })
}))

export default router