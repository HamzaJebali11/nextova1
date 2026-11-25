import { Router } from 'express'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'
import { recordError } from '../../utils/errorLog.js'
import { ErrorLog } from './system.models.js'
import Order from '../orders/order.model.js'

const router = Router()

// ---- public: browser errors (ErrorBoundary + window errors). Small, rate limited, de-duplicated. ----
const clientLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many reports' } })
const clientSchema = z.object({
  message: z.string().max(500),
  page: z.string().max(200).optional(),
  kind: z.enum(['boundary', 'error', 'rejection']).default('error'),
})
router.post('/client-errors', clientLimiter, asyncHandler(async (req, res) => {
  if (Number(req.headers['content-length'] || 0) > 4000) return res.status(413).json({ message: 'Too large' })
  const d = clientSchema.parse(req.body)
  await recordError({ source: 'client', message: `${d.kind}: ${d.message}`, route: d.page || '' })
  res.status(204).end()
}))

// ---- admin: System status ----
router.get('/status', protect, asyncHandler(async (req, res) => {
  const t0 = Date.now()
  let dbOk = false
  try { await mongoose.connection.db.admin().ping(); dbOk = true } catch { /* down */ }
  const dbMs = Date.now() - t0
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [lastOrder, lastWebsiteOrder, count24, errors] = await Promise.all([
    Order.findOne().sort({ createdAt: -1 }).select('orderNumber createdAt source').lean(),
    Order.findOne({ source: 'website' }).sort({ createdAt: -1 }).select('createdAt').lean(),
    ErrorLog.aggregate([{ $match: { lastAt: { $gte: since } } }, { $group: { _id: '$source', n: { $sum: '$count' } } }]),
    ErrorLog.find().sort({ lastAt: -1 }).limit(200).lean(),
  ])
  const by = Object.fromEntries(count24.map((c) => [c._id, c.n]))
  res.json({
    db: { ok: dbOk, ms: dbMs, state: mongoose.connection.readyState },
    server: { uptimeSec: Math.round(process.uptime()), node: process.version, time: new Date() },
    lastOrder: lastOrder ? { orderNumber: lastOrder.orderNumber, at: lastOrder.createdAt, source: lastOrder.source } : null,
    lastWebsiteOrderAt: lastWebsiteOrder?.createdAt || null,
    errors24h: { server: by.server || 0, client: by.client || 0, total: (by.server || 0) + (by.client || 0) },
    errors,
  })
}))

router.delete('/errors', protect, asyncHandler(async (req, res) => {
  const r = await ErrorLog.deleteMany({})
  res.json({ deleted: r.deletedCount })
}))

export default router
