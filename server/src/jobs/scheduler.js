import mongoose from 'mongoose'
import Settings from '../modules/settings/settings.model.js'
import Order from '../modules/orders/order.model.js'
import { JobRun } from '../modules/system/system.models.js'
import { periodOf, previousPeriod, profitReport, compare, qToday, addDays } from '../utils/reportData.js'
import { reportEmailHtml } from '../utils/reportEmail.js'
import { sendEmail, esc } from '../utils/email.js'
import { alertOnce, recordError } from '../utils/errorLog.js'

// A simple check every 5 minutes (no package needed). Every job writes a JobRun record first, so after a
// restart or with two server copies nothing is sent twice:
//   weekly report  -> Sunday from 08:00 Qatar time (the week Saturday-Friday that just ended)
//   monthly report -> day 1 from 08:00 Qatar time (the month that just ended)
//   "no order for N hours" alert (Settings > Alerts), at most once per hour
const EVERY = 5 * 60 * 1000
const qatarNow = () => new Date(Date.now() + 3 * 60 * 60 * 1000) // read with getUTC*

async function claim(key) {
  try { await JobRun.create({ key }); return true } catch { return false } // unique key: someone already did it
}

export async function sendReport(kind, settings) {
  const today = qToday()
  const period = previousPeriod(periodOf(kind, today))
  const key = `report:${kind}:${period.from}`
  if (!(await claim(key))) return
  const [cur, prev] = await Promise.all([profitReport(period), profitReport(previousPeriod(period))])
  const r = { ...cur, previous: { period: prev.period, totals: prev.totals }, change: compare(cur.totals, prev.totals) }
  const result = await sendEmail({
    to: settings.reportEmail.to,
    subject: `${settings.storeName || 'Nextova'} ${kind === 'month' ? 'monthly' : 'weekly'} report ${period.from} to ${period.to}`,
    html: reportEmailHtml(r, settings),
  })
  await JobRun.updateOne({ key }, { result: result.sent ? 'sent' : result.reason })
}

export async function tick() {
  if (mongoose.connection.readyState !== 1) return
  const s = await Settings.findOne({ key: 'main' }).lean()
  if (!s) return
  const now = qatarNow()
  const hour = now.getUTCHours()

  if (s.reportEmail?.to && hour >= 8) {
    if (s.reportEmail.weekly && now.getUTCDay() === 0) await sendReport('week', s)
    if (s.reportEmail.monthly && now.getUTCDate() === 1) await sendReport('month', s)
  }

  const hours = Number(s.alerts?.noOrderHours) || 0
  if (s.alerts?.enabled && hours > 0) {
    const last = await Order.findOne({ source: 'website' }).sort({ createdAt: -1 }).select('createdAt').lean()
    const since = last ? Date.now() - new Date(last.createdAt).getTime() : Infinity
    if (since > hours * 60 * 60 * 1000) {
      await alertOnce('no-orders', `No website order for ${hours}+ hours`,
        `<p>No order has been placed on the website for more than ${esc(hours)} hours${last ? ` (last one ${esc(new Date(last.createdAt).toISOString().slice(0, 16).replace('T', ' '))} UTC)` : ''}.</p><p>Check that the site and the order form work.</p>`)
    }
  }
}

export function startScheduler() {
  const run = () => tick().catch((e) => recordError({ source: 'server', message: `Scheduler: ${e.message}`, route: 'scheduler' }))
  setTimeout(run, 60 * 1000)
  return setInterval(run, EVERY)
}

export { addDays }
