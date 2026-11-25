import { Router } from 'express'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import Order from '../orders/order.model.js'
import Customer from './customer.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'
import { normalizeQatarPhone, phoneKey, phoneMatch } from '../../utils/phone.js'

// Customers = orders grouped by phone number (the last 8 digits, so older formats are matched too).
// The small "customers" collection only holds what you add: notes, tags, opt-out, block list.
const router = Router()
router.use(protect)

const DAY = 24 * 60 * 60 * 1000
const r2 = (n) => Math.round((n || 0) * 100) / 100
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SORTS = {
  last: { last: -1 }, first: { first: 1 }, orders: { orders: -1, last: -1 }, spent: { spent: -1, last: -1 },
  failed: { failed: -1, last: -1 }, name: { name: 1 },
}

// key = last 8 digits of the stored number (null for "N/A")
const KEY = { $let: { vars: { m: { $regexFind: { input: { $ifNull: ['$customer.phone', ''] }, regex: /(\d{8})\s*$/ } } }, in: { $arrayElemAt: ['$$m.captures', 0] } } }

function pipeline(query, { keys } = {}) {
  const { q, filter } = query
  const pre = [{ $match: { 'customer.phone': { $regex: /\d{8}\s*$/ } } }]
  if (keys) pre.push({ $match: { $or: keys.map((k) => phoneMatch(k)) } })
  const post = []
  if (q && String(q).trim()) {
    const t = String(q).trim().slice(0, 60)
    const digits = t.replace(/\D/g, '')
    const or = [{ name: new RegExp(escapeRegex(t), 'i') }]
    if (digits.length >= 3) or.push({ _id: new RegExp(escapeRegex(digits.slice(-8))) })
    post.push({ $match: { $or: or } })
  }
  if (filter === 'repeat') post.push({ $match: { orders: { $gte: 2 } } })
  if (filter === 'failed') post.push({ $match: { failed: { $gt: 0 } } })
  if (filter === 'blocked') post.push({ $match: { 'meta.blocked': true } })
  if (filter === 'inactive') post.push({ $match: { last: { $lt: new Date(Date.now() - 30 * DAY) } } })
  return [
    ...pre,
    { $sort: { createdAt: -1 } },
    { $addFields: { _k: KEY } },
    {
      $group: {
        _id: '$_k',
        name: { $first: '$customer.name' },
        phone: { $first: '$customer.phone' },
        orders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        spent: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] } },
        first: { $min: '$createdAt' },
        last: { $max: '$createdAt' },
        zones: { $push: '$customer.zone' },
      },
    },
    { $lookup: { from: 'customers', localField: '_id', foreignField: 'key', as: 'meta' } },
    { $addFields: { meta: { $arrayElemAt: ['$meta', 0] } } },
    ...post,
  ]
}

function shape(r) {
  const count = {}
  for (const z of r.zones || []) if (z) count[z] = (count[z] || 0) + 1
  const mainZone = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  return {
    key: r._id, name: r.name, phone: normalizeQatarPhone(r.phone) || r.phone,
    orders: r.orders, delivered: r.delivered, failed: r.failed, cancelled: r.cancelled,
    spent: r2(r.spent), avg: r.delivered ? r2(r.spent / r.delivered) : 0,
    first: r.first, last: r.last, mainZone,
    blocked: !!r.meta?.blocked, optOut: !!r.meta?.optOut, tags: r.meta?.tags || [], hasNotes: !!r.meta?.notes,
  }
}

// blocked phones that have no order yet still show in the "Blocked" filter
async function blockedWithoutOrders(rows, query) {
  if (query.filter !== 'blocked') return []
  const seen = new Set(rows.map((r) => r.key))
  const list = await Customer.find({ blocked: true }).lean()
  const q = String(query.q || '').replace(/\D/g, '')
  return list.filter((c) => !seen.has(c.key) && (!q || c.key.includes(q.slice(-8)))).map((c) => ({
    key: c.key, name: '', phone: c.phone || `+974${c.key}`, orders: 0, delivered: 0, failed: 0, cancelled: 0,
    spent: 0, avg: 0, first: null, last: null, mainZone: '', blocked: true, optOut: !!c.optOut, tags: c.tags || [], hasNotes: !!c.notes,
  }))
}

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30))
  const sort = SORTS[req.query.sort] || SORTS.last
  const [out] = await Order.aggregate([
    ...pipeline(req.query),
    { $facet: { rows: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]).allowDiskUse(true)
  const rows = out.rows.map(shape)
  const extra = page === 1 ? await blockedWithoutOrders(rows, req.query) : []
  const total = (out.total[0]?.n || 0) + extra.length
  res.json({ items: [...rows, ...extra], total, page, pages: Math.max(1, Math.ceil(total / limit)) })
}))

// Excel of the filtered list
router.get('/export.xlsx', asyncHandler(async (req, res) => {
  const sort = SORTS[req.query.sort] || SORTS.last
  const raw = await Order.aggregate([...pipeline(req.query), { $sort: sort }, { $limit: 20000 }]).allowDiskUse(true)
  const rows = raw.map(shape)
  rows.push(...await blockedWithoutOrders(rows, req.query))
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Customers', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'Name (latest)', key: 'name', width: 24 }, { header: 'Mobile', key: 'phone', width: 16 },
    { header: 'Orders', key: 'orders', width: 8 }, { header: 'Delivered', key: 'delivered', width: 10 },
    { header: 'Failed', key: 'failed', width: 8 }, { header: 'Total spent (delivered, QAR)', key: 'spent', width: 16 },
    { header: 'Average order (QAR)', key: 'avg', width: 12 }, { header: 'First order', key: 'first', width: 12 },
    { header: 'Last order', key: 'last', width: 12 }, { header: 'Main zone', key: 'mainZone', width: 10 },
    { header: 'Blocked', key: 'blocked', width: 9 }, { header: 'Opt-out', key: 'optOut', width: 9 }, { header: 'Tags', key: 'tags', width: 20 },
  ]
  const d = (x) => (x ? new Date(new Date(x).getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10) : '')
  for (const r of rows) {
    ws.addRow({ ...r, first: d(r.first), last: d(r.last), blocked: r.blocked ? 'Yes' : '', optOut: r.optOut ? 'Yes' : '', tags: r.tags.join(', ') })
  }
  ws.getRow(1).font = { bold: true }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="customers.xlsx"')
  await wb.xlsx.write(res)
  res.end()
}))

const keyOf = (raw) => {
  const k = phoneKey(raw)
  if (!/^\d{8}$/.test(k)) throw httpError(400, 'Enter a phone number')
  return k
}

// one customer: summary, notes / tags / block, and the order history of this phone (old formats included)
router.get('/:key', asyncHandler(async (req, res) => {
  const key = keyOf(req.params.key)
  const [meta, orders] = await Promise.all([
    Customer.findOne({ key }).lean(),
    Order.find(phoneMatch(key)).sort({ createdAt: -1 }).limit(200)
      .select('orderNumber status total createdAt deliveredAt customer.name customer.zone customer.area items.name items.qty items.variantName items.price failure flags source')
      .lean(),
  ])
  const delivered = orders.filter((o) => o.status === 'delivered')
  const spent = delivered.reduce((s, o) => s + (o.total || 0), 0)
  res.json({
    key,
    phone: `+974${key}`,
    name: orders[0]?.customer?.name || '',
    meta: meta || { key, notes: '', tags: [], optOut: false, blocked: false },
    summary: {
      orders: orders.length, delivered: delivered.length,
      failed: orders.filter((o) => o.status === 'returned').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      spent: r2(spent), avg: delivered.length ? r2(spent / delivered.length) : 0,
      first: orders[orders.length - 1]?.createdAt || null, last: orders[0]?.createdAt || null,
    },
    orders,
  })
}))

const metaSchema = z.object({
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  optOut: z.boolean().optional(),
  blocked: z.boolean().optional(),
  blockNote: z.string().trim().max(300).optional(),
})

async function saveMeta(key, data, by, phone) {
  const set = { ...data, phone: phone || `+974${key}` }
  if (data.blocked === true) { set.blockedAt = new Date(); set.blockedBy = by }
  if (data.blocked === false) { set.blockNote = data.blockNote ?? '' }
  return Customer.findOneAndUpdate({ key }, { $set: set, $setOnInsert: { key } }, { upsert: true, returnDocument: 'after', runValidators: true })
}

router.patch('/:key', asyncHandler(async (req, res) => {
  const key = keyOf(req.params.key)
  const data = metaSchema.parse(req.body)
  res.json(await saveMeta(key, data, req.admin?.name || req.admin?.email))
}))

// add a phone to the block list (also numbers that never ordered)
router.post('/block', asyncHandler(async (req, res) => {
  const { phone, note } = z.object({ phone: z.string().trim().min(8).max(40), note: z.string().trim().max(300).optional() }).parse(req.body)
  const normal = normalizeQatarPhone(phone)
  const key = keyOf(normal || phone)
  res.status(201).json(await saveMeta(key, { blocked: true, blockNote: note || '' }, req.admin?.name || req.admin?.email, normal || undefined))
}))

export default router
