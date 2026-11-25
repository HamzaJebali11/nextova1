import Order from '../modules/orders/order.model.js'
import Product from '../modules/products/product.model.js'
import AdSpend from '../modules/adspend/adspend.model.js'
import Settings from '../modules/settings/settings.model.js'

// All dates are Qatar calendar days (UTC+3). Keys are 'YYYY-MM-DD'.
const OFFSET = 3 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000
const r2 = (n) => Math.round((n || 0) * 100) / 100
export const qKey = (d) => new Date(new Date(d).getTime() + OFFSET).toISOString().slice(0, 10)
export const qToday = () => qKey(Date.now())
export const keyToStart = (k) => new Date(`${k}T00:00:00+03:00`)
export const addDays = (k, n) => new Date(Date.parse(`${k}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)

// ---------- periods: week starts on Saturday; month = calendar month ----------
export function periodOf(kind, dayKey = qToday()) {
  if (kind === 'month') {
    const from = `${dayKey.slice(0, 7)}-01`
    const next = new Date(Date.parse(`${from}T00:00:00Z`))
    next.setUTCMonth(next.getUTCMonth() + 1)
    const to = addDays(next.toISOString().slice(0, 10), -1)
    return { kind, from, to }
  }
  const dow = new Date(Date.parse(`${dayKey}T00:00:00Z`)).getUTCDay() // 0 Sunday … 6 Saturday
  const from = addDays(dayKey, -((dow + 1) % 7))                      // back to Saturday
  return { kind: 'week', from, to: addDays(from, 6) }
}
export const previousPeriod = (p) => periodOf(p.kind, addDays(p.from, -1))
export const nextPeriod = (p) => periodOf(p.kind, addDays(p.to, 1))

// ---------- delivered / failed dates ----------
// delivered: deliveredAt (older orders without it: last update); failed: failure.at (older: last update)
const deliveredDate = { $ifNull: ['$deliveredAt', '$updatedAt'] }
const failedDate = { $ifNull: ['$failure.at', '$updatedAt'] }

// ad spend per day (each entry spread evenly over the days it covers), split by product (null = not assigned)
async function adSpendByDay(from, to) {
  const entries = await AdSpend.find().lean()
  const out = [] // { day, product, amount }
  for (const a of entries) {
    const start = qKey(a.startDate)
    const per = (a.amount || 0) / (a.days || 1)
    for (let i = 0; i < (a.days || 1); i++) {
      const k = addDays(start, i)
      if (k < from || k > to) continue
      out.push({ day: k, product: a.product ? String(a.product) : null, amount: per })
    }
  }
  return out
}

// ---------- profit report (cash view) ----------
// net profit = revenue of delivered orders - BASE cost of the delivered units - delivery costs - ad spend
export async function profitReport(period) {
  const { from, to } = period
  const start = keyToStart(from)
  const end = keyToStart(addDays(to, 1))
  const settings = (await Settings.findOne({ key: 'main' }).lean()) || {}
  const perDelivery = Number(settings.deliveryCostPerOrder) || 0
  const perFailed = Number(settings.failedDeliveryCost) || 0

  const [placed, delivered, failed, ads] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    // the date filter runs inside the database (indexes status + deliveredAt / failure.at)
    Order.aggregate([
      { $match: { status: 'delivered', $or: [{ deliveredAt: { $gte: start, $lt: end } }, { deliveredAt: null, updatedAt: { $gte: start, $lt: end } }] } },
      { $project: { total: 1, items: 1, _d: deliveredDate } },
    ]),
    Order.aggregate([
      { $match: { status: 'returned', $or: [{ 'failure.at': { $gte: start, $lt: end } }, { 'failure.at': null, updatedAt: { $gte: start, $lt: end } }] } },
      { $project: { 'items.product': 1, _d: failedDate } },
    ]),
    adSpendByDay(from, to),
  ])

  // base cost: the cost saved on the order line (the product's base cost when it was ordered);
  // when a line has no cost saved, the product's current base cost is used
  const ids = [...new Set([...delivered, ...failed].flatMap((o) => (o.items || []).map((i) => String(i.product))).concat(ads.map((a) => a.product)).filter((x) => x && x !== 'undefined' && x !== 'null'))]
  const products = await Product.find({ _id: { $in: ids } }).select('+costPrice name').lean()
  const prod = new Map(products.map((p) => [String(p._id), p]))

  const days = {}
  for (let k = from; k <= to; k = addDays(k, 1)) days[k] = { day: k, revenue: 0, baseCost: 0, delivery: 0, adSpend: 0, delivered: 0, failed: 0 }
  const per = {} // product id -> row
  const row = (id, name) => (per[id] ||= { id, name, units: 0, revenue: 0, baseCost: 0, adSpend: 0, deliveredOrders: 0, failedOrders: 0 })

  let revenue = 0
  let baseCost = 0
  for (const o of delivered) {
    const d = days[qKey(o._d)]
    revenue += o.total || 0
    if (d) { d.revenue += o.total || 0; d.delivered += 1; d.delivery += perDelivery }
    const seen = new Set()
    for (const it of o.items || []) {
      const id = String(it.product || 'deleted')
      const p = prod.get(id)
      const unitCost = it.cost || p?.costPrice || 0
      const c = unitCost * (it.qty || 0)
      baseCost += c
      if (d) d.baseCost += c
      const r = row(id, p?.name?.en || it.name || 'Deleted product')
      r.units += it.qty || 0
      r.revenue += (it.price || 0) * (it.qty || 0)
      r.baseCost += c
      if (!seen.has(id)) { r.deliveredOrders += 1; seen.add(id) }
    }
  }
  for (const o of failed) {
    const d = days[qKey(o._d)]
    if (d) { d.failed += 1; d.delivery += perFailed }
    for (const id of new Set((o.items || []).map((i) => String(i.product || 'deleted')))) {
      row(id, prod.get(id)?.name?.en || 'Deleted product').failedOrders += 1
    }
  }
  let adSpend = 0
  let adUnassigned = 0
  for (const a of ads) {
    adSpend += a.amount
    if (days[a.day]) days[a.day].adSpend += a.amount
    if (a.product) {
      row(a.product, prod.get(a.product)?.name?.en || 'Deleted product').adSpend += a.amount
    } else adUnassigned += a.amount
  }
  const deliveryCost = delivered.length * perDelivery + failed.length * perFailed
  const net = revenue - baseCost - deliveryCost - adSpend

  const productRows = Object.values(per).map((r) => {
    const finished = r.deliveredOrders + r.failedOrders
    return {
      ...r, revenue: r2(r.revenue), baseCost: r2(r.baseCost), adSpend: r2(r.adSpend),
      profit: r2(r.revenue - r.baseCost - r.adSpend),
      failedRate: finished ? Math.round((r.failedOrders / finished) * 1000) / 10 : 0,
    }
  }).sort((a, b) => b.profit - a.profit)
  const ranked = productRows.filter((r) => r.units > 0 || r.adSpend > 0)

  return {
    period,
    settings: { deliveryCostPerOrder: perDelivery, failedDeliveryCost: perFailed },
    totals: {
      placed, delivered: delivered.length, failed: failed.length,
      deliveryRate: delivered.length + failed.length ? Math.round((delivered.length / (delivered.length + failed.length)) * 1000) / 10 : null,
      revenue: r2(revenue), baseCost: r2(baseCost), deliveryCost: r2(deliveryCost), adSpend: r2(adSpend),
      adUnassigned: r2(adUnassigned), net: r2(net),
    },
    products: productRows,
    best: ranked[0] || null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    days: Object.values(days).map((d) => ({ ...d, revenue: r2(d.revenue), baseCost: r2(d.baseCost), delivery: r2(d.delivery), adSpend: r2(d.adSpend), profit: r2(d.revenue - d.baseCost - d.delivery - d.adSpend) })),
  }
}

// change against the previous period, in % (null when the previous value is 0)
export function compare(cur, prev) {
  const out = {}
  for (const k of Object.keys(cur)) {
    const a = cur[k]
    const b = prev[k]
    if (typeof a !== 'number' || typeof b !== 'number') continue
    out[k] = b === 0 ? null : Math.round(((a - b) / Math.abs(b)) * 1000) / 10
  }
  return out
}

// ---------- delivery performance ----------
const REASONS = ['refused', 'no_answer', 'wrong_address', 'changed_mind', 'other']

// orders PLACED in the period, by outcome; failed ones broken down by reason, zone, product, campaign, ad, angle and day
export async function deliveryReport(from, to) {
  const start = keyToStart(from)
  const end = keyToStart(addDays(to, 1))
  const orders = await Order.find({ createdAt: { $gte: start, $lt: end } })
    .select('status failure customer.zone items.product items.name attribution utm angle createdAt').lean()
  const names = new Map((await Product.find({ _id: { $in: [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.product))))].filter((x) => x !== 'undefined') } }).select('name').lean()).map((p) => [String(p._id), p.name?.en]))

  const t = { placed: orders.length, delivered: 0, failed: 0, cancelled: 0, open: 0 }
  const dims = { reason: {}, zone: {}, product: {}, campaign: {}, ad: {}, angle: {} }
  const add = (dim, key, label, outcome) => {
    const r = (dims[dim][key] ||= { key, label, delivered: 0, failed: 0 })
    r[outcome] += 1
  }
  const days = {}
  for (let k = from; k <= to; k = addDays(k, 1)) days[k] = { day: k, placed: 0, delivered: 0, failed: 0 }

  for (const o of orders) {
    const day = days[qKey(o.createdAt)]
    if (day) day.placed += 1
    const outcome = o.status === 'delivered' ? 'delivered' : o.status === 'returned' ? 'failed' : null
    if (o.status === 'cancelled') t.cancelled += 1
    else if (!outcome) t.open += 1
    if (!outcome) continue
    t[outcome] += 1
    if (day) day[outcome] += 1
    const a = o.attribution || {}
    if (outcome === 'failed') add('reason', o.failure?.reason || 'none', o.failure?.reason || 'No reason saved', 'failed')
    add('zone', o.customer?.zone || '', o.customer?.zone ? `Zone ${o.customer.zone}` : 'No zone', outcome)
    for (const id of new Set(o.items.map((i) => String(i.product || '')))) {
      add('product', id, names.get(id) || o.items.find((i) => String(i.product) === id)?.name || 'Deleted product', outcome)
    }
    const camp = a.campaignId || a.campaign || o.utm?.campaign
    add('campaign', camp || '', a.campaign || o.utm?.campaign || (a.campaignId ? `#${a.campaignId}` : 'No campaign'), outcome)
    const ad = a.adId || a.content
    add('ad', ad || '', a.content || (a.adId ? `#${a.adId}` : 'No ad'), outcome)
    add('angle', o.angle?.slug || '', o.angle?.slug ? `angle: ${o.angle.slug}` : 'No angle', outcome)
  }
  const rate = (d, f) => (d + f ? Math.round((d / (d + f)) * 1000) / 10 : null)
  const list = (dim) => Object.values(dims[dim])
    .map((r) => ({ ...r, rate: rate(r.delivered, r.failed) }))
    .sort((x, y) => y.failed - x.failed || y.delivered - x.delivered)
  return {
    from, to,
    totals: { ...t, deliveryRate: rate(t.delivered, t.failed) },
    byReason: REASONS.map((k) => ({ key: k, failed: dims.reason[k]?.failed || 0 })).concat(dims.reason.none ? [{ key: 'none', failed: dims.reason.none.failed }] : []),
    byZone: list('zone'), byProduct: list('product'), byCampaign: list('campaign'), byAd: list('ad'), byAngle: list('angle'),
    byDay: Object.values(days),
  }
}

// real delivery rate of the last N days (orders placed in that window that reached delivered or failed)
export async function realDeliveryRate(days = 30) {
  const to = qToday()
  const from = addDays(to, -(days - 1))
  const [r] = await Order.aggregate([
    { $match: { createdAt: { $gte: keyToStart(from) }, status: { $in: ['delivered', 'returned'] } } },
    { $group: { _id: null, delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } } } },
  ])
  const d = r?.delivered || 0
  const f = r?.failed || 0
  return { days, from, to, delivered: d, failed: f, rate: d + f ? Math.round((d / (d + f)) * 1000) / 10 : null }
}

export { daysBetween }
