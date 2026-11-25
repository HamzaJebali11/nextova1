import { Router } from 'express'
import ExcelJS from 'exceljs'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'
import Settings from '../settings/settings.model.js'
import {
  periodOf, previousPeriod, profitReport, compare, deliveryReport, realDeliveryRate, qToday, addDays, daysBetween,
} from '../../utils/reportData.js'
import { reportEmailHtml } from '../../utils/reportEmail.js'
import { sendEmail } from '../../utils/email.js'

const router = Router()
router.use(protect)

const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))

async function profitWithCompare(kind, day) {
  const period = periodOf(kind === 'month' ? 'month' : 'week', isDay(day) ? day : qToday())
  const [cur, prev] = await Promise.all([profitReport(period), profitReport(previousPeriod(period))])
  return { ...cur, previous: { period: prev.period, totals: prev.totals }, change: compare(cur.totals, prev.totals) }
}

// ---- weekly / monthly profit (cash view) ----
router.get('/profit', asyncHandler(async (req, res) => {
  res.json(await profitWithCompare(req.query.period, req.query.date))
}))

router.get('/profit.xlsx', asyncHandler(async (req, res) => {
  const r = await profitWithCompare(req.query.period, req.query.date)
  const wb = new ExcelJS.Workbook()
  const sum = wb.addWorksheet('Summary')
  sum.columns = [{ header: 'Number', key: 'k', width: 34 }, { header: 'This period', key: 'a', width: 16 }, { header: 'Previous period', key: 'b', width: 16 }, { header: 'Change %', key: 'c', width: 10 }]
  const T = r.totals
  const P = r.previous.totals
  const lines = [
    ['Orders placed', 'placed'], ['Delivered', 'delivered'], ['Failed', 'failed'], ['Revenue (delivered, QAR)', 'revenue'],
    ['Base cost of delivered units (QAR)', 'baseCost'], ['Delivery costs (QAR)', 'deliveryCost'], ['Ad spend (QAR)', 'adSpend'], ['Net profit (QAR)', 'net'],
  ]
  sum.addRow({ k: `Period: ${r.period.from} to ${r.period.to} (${r.period.kind})` })
  for (const [label, key] of lines) sum.addRow({ k: label, a: T[key], b: P[key], c: r.change[key] ?? '' })
  sum.addRow({})
  sum.addRow({ k: 'Net profit = revenue - base cost of delivered units - delivery costs - ad spend' })
  sum.getRow(1).font = { bold: true }
  const pr = wb.addWorksheet('Products')
  pr.columns = [
    { header: 'Product', key: 'name', width: 30 }, { header: 'Units delivered', key: 'units', width: 10 },
    { header: 'Revenue', key: 'revenue', width: 12 }, { header: 'Base cost', key: 'baseCost', width: 12 },
    { header: 'Ad spend', key: 'adSpend', width: 12 }, { header: 'Profit', key: 'profit', width: 12 }, { header: 'Failed rate %', key: 'failedRate', width: 10 },
  ]
  for (const p of r.products) pr.addRow(p)
  if (T.adUnassigned) pr.addRow({ name: 'Ad spend not assigned to a product', adSpend: T.adUnassigned, profit: -T.adUnassigned })
  pr.getRow(1).font = { bold: true }
  const dd = wb.addWorksheet('By day')
  dd.columns = [{ header: 'Day', key: 'day', width: 12 }, { header: 'Delivered', key: 'delivered', width: 10 }, { header: 'Failed', key: 'failed', width: 8 },
    { header: 'Revenue', key: 'revenue', width: 12 }, { header: 'Base cost', key: 'baseCost', width: 12 }, { header: 'Delivery', key: 'delivery', width: 10 },
    { header: 'Ad spend', key: 'adSpend', width: 10 }, { header: 'Profit', key: 'profit', width: 12 }]
  for (const d of r.days) dd.addRow(d)
  dd.getRow(1).font = { bold: true }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="profit-${r.period.kind}-${r.period.from}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
}))

// "Send me this report now" (to the address in Settings > Reports by email)
router.post('/profit/send', asyncHandler(async (req, res) => {
  const s = await Settings.findOne({ key: 'main' }).lean()
  const to = s?.reportEmail?.to
  if (!to) throw httpError(400, 'Enter the report e-mail address in Settings first')
  const r = await profitWithCompare(req.body?.period, req.body?.date)
  const result = await sendEmail({ to, subject: `${s.storeName || 'Nextova'} ${r.period.kind === 'month' ? 'monthly' : 'weekly'} report ${r.period.from} to ${r.period.to}`, html: reportEmailHtml(r, s) })
  res.json(result)
}))

// ---- delivery performance (orders placed in the period) ----
router.get('/delivery', asyncHandler(async (req, res) => {
  const to = isDay(req.query.to) ? req.query.to : qToday()
  const from = isDay(req.query.from) ? req.query.from : addDays(to, -29)
  if (from > to || daysBetween(from, to) > 400) throw httpError(400, 'Choose a period of at most 400 days')
  res.json(await deliveryReport(from, to))
}))

// real delivery rate of the last N days (Planner)
router.get('/delivery-rate', asyncHandler(async (req, res) => {
  res.json(await realDeliveryRate(Math.min(365, Math.max(7, Number(req.query.days) || 30))))
}))

export default router
