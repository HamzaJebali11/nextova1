import { Router } from 'express'
import ExcelJS from 'exceljs'
import Order from '../orders/order.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'

const router = Router()
router.use(protect)

const OPEN = ['new', 'confirmed', 'processing', 'out_for_delivery']
const LABELS = {
  new: 'New', confirmed: 'Confirmed', processing: 'Processing', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned',
}
const OFFSET = 3 * 60 * 60 * 1000 // Qatar is UTC+3
const qDate = (d) => new Date(new Date(d).getTime() + OFFSET).toISOString().slice(0, 10)
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildFilter(query) {
  const { status, search, from, to, zone, source } = query
  const filter = {}
  if (status) {
    const list = String(status).split(',').map((s) => s.trim()).filter(Boolean)
    if (list.length === 1) filter.status = list[0]
    else if (list.length > 1) filter.status = { $in: list }
  }
  if (zone) filter['customer.zone'] = String(zone).trim()
  if (source === 'website') filter.source = 'website'
  else if (source === 'other') filter.source = { $ne: 'website' }
  if (search) {
    const rx = new RegExp(escapeRegex(String(search)), 'i')
    filter.$or = [{ orderNumber: rx }, { 'customer.phone': rx }, { 'customer.name': rx }]
  }
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  return filter
}

// ---- Excel file: /api/v1/exports/orders.xlsx?status=new,confirmed&zone=55&from=...&to=...&search=... ----
router.get('/orders.xlsx', asyncHandler(async (req, res) => {
  const orders = await Order.find(buildFilter(req.query)).sort({ createdAt: 1 }).limit(5000).lean()

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nextova'
  const ws = wb.addWorksheet('Orders', { views: [{ state: 'frozen', ySplit: 1 }] })

  ws.columns = [
    { header: 'Order', key: 'orderNumber', width: 11 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Customer', key: 'name', width: 22 },
    { header: 'Mobile', key: 'phone', width: 16 },
    { header: 'Area', key: 'area', width: 16 },
    { header: 'Zone', key: 'zone', width: 8 },
    { header: 'Street', key: 'street', width: 9 },
    { header: 'Building', key: 'building', width: 10 },
    { header: 'Landmark / details', key: 'address', width: 30 },
    { header: 'Items (with options)', key: 'items', width: 44 },
    { header: 'Amount to collect (QAR)', key: 'total', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Source', key: 'source', width: 11 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Location link', key: 'location', width: 32 },
    { header: 'Done ✓', key: 'done', width: 9 },
  ]

  for (const o of orders) {
    const items = o.items
      .map((i) => `${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''}${i.price === 0 ? ' (free gift)' : ''}`)
      .join('\n')
    const row = ws.addRow({
      orderNumber: o.orderNumber,
      date: qDate(o.createdAt),
      name: o.customer.name,
      phone: o.customer.phone,
      area: o.customer.area || '',
      zone: o.customer.zone || '',
      street: o.customer.street || '',
      building: o.customer.building || '',
      address: o.customer.address || '',
      items,
      total: o.total,
      status: LABELS[o.status] || o.status,
      source: o.source || 'website',
      notes: o.customer.notes || '',
      location: o.location?.url || '',
      done: '',
    })
    row.alignment = { vertical: 'top', wrapText: true }
  }

  const toCollect = orders
    .filter((o) => !['cancelled', 'returned'].includes(o.status))
    .reduce((s, o) => s + (o.total || 0), 0)
  ws.addRow({})
  const totalRow = ws.addRow({ name: 'TOTAL TO COLLECT', total: toCollect })
  totalRow.font = { bold: true }

  ws.getColumn('total').numFmt = '#,##0.00'
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }
  header.alignment = { vertical: 'middle', wrapText: true }
  header.height = 30
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="orders-${qDate(Date.now())}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
}))

// ---- data for the delivery sheet: open orders + what was delivered today ----
router.get('/delivery', asyncHandler(async (req, res) => {
  const startOfDay = new Date(`${qDate(Date.now())}T00:00:00+03:00`)
  const [open, deliveredToday] = await Promise.all([
    Order.find({ status: { $in: OPEN } }).sort({ createdAt: 1 }).limit(500).lean(),
    Order.find({ status: 'delivered', deliveredAt: { $gte: startOfDay } }).sort({ deliveredAt: -1 }).limit(500).lean(),
  ])
  res.json({ open, deliveredToday })
}))

export default router