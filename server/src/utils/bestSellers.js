import Order from '../modules/orders/order.model.js'
import Product from '../modules/products/product.model.js'

// "Best seller" (automatic): the top products by REAL units sold in the last 30 days
// (paid order lines of orders that are not cancelled or failed; free gifts not counted),
// only when a product sold at least 5 units. Computed on the server and cached for one hour.
// Each product can override it in the product form: auto (default) / always / never.
const TOP = 5
const MIN_UNITS = 5
const HOUR = 60 * 60 * 1000
let cached = { at: 0, ids: new Set() }
let running = null

async function compute() {
  const since = new Date(Date.now() - 30 * 24 * HOUR)
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: since }, status: { $nin: ['cancelled', 'returned'] } } },
    { $unwind: '$items' },
    { $match: { 'items.price': { $gt: 0 }, 'items.product': { $ne: null } } },
    { $group: { _id: '$items.product', units: { $sum: '$items.qty' } } },
    { $match: { units: { $gte: MIN_UNITS } } },
    { $sort: { units: -1 } },
    { $limit: TOP },
  ])
  const [always, never] = await Promise.all([
    Product.find({ bestSeller: 'always' }).distinct('_id'),
    Product.find({ bestSeller: 'never' }).distinct('_id'),
  ])
  const ids = new Set(rows.map((r) => String(r._id)))
  for (const id of always) ids.add(String(id))
  for (const id of never) ids.delete(String(id))
  cached = { at: Date.now(), ids }
  return ids
}

export async function bestSellerIds() {
  if (Date.now() - cached.at < HOUR) return cached.ids
  running ||= compute().finally(() => { running = null })
  return running
}
export function refreshBestSellers() { cached.at = 0 }

// adds isBestSeller to products (or a single product)
export async function markBestSellers(list) {
  const ids = await bestSellerIds().catch(() => new Set())
  const mark = (p) => (p ? { ...p, isBestSeller: ids.has(String(p._id)) } : p)
  return Array.isArray(list) ? list.map(mark) : mark(list)
}
