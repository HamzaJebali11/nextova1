import { Router } from 'express'
import mongoose from 'mongoose'
import SalesEvent from './event.model.js'
import Order from '../orders/order.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

// SALES EVENTS: display only. Nothing here touches prices, totals or reports.
const router = Router()

const publicView = (e) => e && ({
  id: String(e._id),
  name: e.name,
  minPct: e.minPct || 0,
  maxPct: e.maxPct,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
})

// the event live right now (several live: the one that ends first), or null
export async function liveEvent(at = new Date()) {
  return SalesEvent.findOne({ active: true, startsAt: { $lte: at }, endsAt: { $gte: at } })
    .sort({ endsAt: 1 }).lean()
}

// small in-memory cache for the public route (about 60 seconds), cleared when you edit events
let cache = { at: 0, value: null }
const clearCache = () => { cache = { at: 0, value: null } }

// ---- public: GET /api/v1/events/active ----
router.get('/active', asyncHandler(async (req, res) => {
  const now = Date.now()
  if (now - cache.at > 60 * 1000) cache = { at: now, value: publicView(await liveEvent(new Date(now))) }
  // never serve an event after its end, even from the cache
  const value = cache.value && new Date(cache.value.endsAt).getTime() >= now ? cache.value : null
  res.set('Cache-Control', 'public, max-age=60')
  res.json(value)
}))

// ---- admin ----
const statusOf = (e, now = Date.now()) =>
  !e.active ? 'off' : now < new Date(e.startsAt).getTime() ? 'upcoming' : now > new Date(e.endsAt).getTime() ? 'ended' : 'live'

router.get('/', protect, asyncHandler(async (req, res) => {
  const list = await SalesEvent.find().sort({ startsAt: -1 }).lean()
  // orders and revenue placed during each event (orders carry the event that was live when placed)
  const stats = await Order.aggregate([
    { $match: { 'event.id': { $in: list.map((e) => e._id) } } },
    {
      $group: {
        _id: '$event.id',
        orders: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 0, '$total'] } },
      },
    },
  ])
  const byId = Object.fromEntries(stats.map((s) => [String(s._id), s]))
  res.json(list.map((e) => ({
    ...e,
    status: statusOf(e),
    orders: byId[String(e._id)]?.orders || 0,
    revenue: Math.round((byId[String(e._id)]?.revenue || 0) * 100) / 100,
  })))
}))

const pick = (b) => ({
  name: { en: String(b.name?.en || '').trim(), ar: String(b.name?.ar || '').trim() },
  startDate: b.startDate,
  endDate: b.endDate,
  minPct: Number(b.minPct) || 0,
  maxPct: Number(b.maxPct),
  active: b.active !== false,
})

router.post('/', protect, asyncHandler(async (req, res) => {
  const doc = await SalesEvent.create(pick(req.body))
  clearCache()
  res.status(201).json(doc)
}))

router.put('/:id', protect, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid event')
  const doc = await SalesEvent.findById(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Event not found' })
  doc.set(pick({ ...doc.toObject(), ...req.body }))
  await doc.save() // runs the date checks again
  clearCache()
  res.json(doc)
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid event')
  const doc = await SalesEvent.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Event not found' })
  clearCache()
  res.json({ message: 'Deleted' })
}))

export default router
