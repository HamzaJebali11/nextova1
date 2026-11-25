import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { ErrorLog, ErrorKind, JobRun } from '../modules/system/system.models.js'
import Settings from '../modules/settings/settings.model.js'
import { sendEmail, esc } from './email.js'

const KEEP = 200
const TEN_MIN = 10 * 60 * 1000

// remove anything that could be customer data: phone-like numbers, e-mails, long ids, query strings
export function scrub(text = '', max = 500) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]')
    .replace(/\b[a-f0-9]{24}\b/gi, '[id]')
    .replace(/\?[^\s'"]*/g, '')
    .slice(0, max)
}
const routeOf = (r = '') => scrub(String(r).split('?')[0], 200)

// fingerprint: source + route pattern + message without numbers
const fingerprintOf = (source, message, route) =>
  crypto.createHash('sha1').update(`${source}|${routeOf(route).replace(/\d+/g, '#')}|${scrub(message, 200).replace(/\d+/g, '#')}`).digest('hex').slice(0, 16)

// save one error (never throws). The same error within 10 minutes only increases its counter.
export async function recordError({ source = 'server', message, route }) {
  try {
    if (mongoose.connection.readyState !== 1) return
    const msg = scrub(message || 'Unknown error')
    const fp = fingerprintOf(source, msg, route)
    const now = new Date()
    const recent = await ErrorLog.findOneAndUpdate(
      { fingerprint: fp, lastAt: { $gte: new Date(now - TEN_MIN) } },
      { $inc: { count: 1 }, $set: { lastAt: now } },
      { returnDocument: 'after' },
    )
    if (!recent) {
      await ErrorLog.create({ source, fingerprint: fp, message: msg, route: routeOf(route), lastAt: now })
      // keep only the last 200 entries
      const old = await ErrorLog.find().sort({ lastAt: -1 }).skip(KEEP).select('_id').lean()
      if (old.length) await ErrorLog.deleteMany({ _id: { $in: old.map((o) => o._id) } })
    }
    await errorAlerts({ fp, source, msg, route: routeOf(route) })
  } catch (e) {
    console.error('Could not save the error log:', e.message)
  }
}

// ---- alert e-mails (Settings > Alerts): at most one e-mail per kind per hour ----
export async function alertOnce(kind, subject, html) {
  const s = await Settings.findOne({ key: 'main' }).select('alerts storeName').lean()
  if (!s?.alerts?.enabled || !s.alerts.email) return { sent: false, reason: 'alerts off' }
  const hour = new Date().toISOString().slice(0, 13)
  try {
    await JobRun.create({ key: `alert:${kind}:${hour}` })
  } catch {
    return { sent: false, reason: 'already sent this hour' } // duplicate key: already sent this hour
  }
  const r = await sendEmail({ to: s.alerts.email, subject: `[${s.storeName || 'Nextova'}] ${subject}`, html })
  await JobRun.updateOne({ key: `alert:${kind}:${hour}` }, { result: r.sent ? 'sent' : r.reason })
  return r
}

async function errorAlerts({ fp, source, msg, route }) {
  // a new kind of error
  let isNew = false
  try { await ErrorKind.create({ fingerprint: fp }); isNew = true } catch { /* seen before */ }
  if (isNew) {
    await alertOnce(`new-error:${fp}`, `New ${source} error`, `<p>A new kind of ${source} error appeared.</p><p><b>${esc(msg)}</b><br/>${esc(route || '')}</p><p>See Admin > System status.</p>`)
  }
  // more than 10 errors within 10 minutes
  const [{ n } = { n: 0 }] = await ErrorLog.aggregate([
    { $match: { lastAt: { $gte: new Date(Date.now() - TEN_MIN) } } },
    { $group: { _id: null, n: { $sum: '$count' } } },
  ])
  if (n > 10) {
    await alertOnce('error-burst', `${n} errors in the last 10 minutes`, `<p>${n} errors happened in the last 10 minutes.</p><p>See Admin > System status.</p>`)
  }
}
