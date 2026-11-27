import mongoose from 'mongoose'
import AdSpend from '../modules/adspend/adspend.model.js'
import Product from '../modules/products/product.model.js'

// REAL COST PER UNIT (option B)
//
//   real cost = base cost + (total ad spend for the product / units purchased)
//   example:    2         + (200 / 200)                                       = 3
//
// - "total ad spend for the product" is every Ads & costs entry linked to that product (all time).
// - "units purchased" is the product's unitsPurchased field; when it was never set we use
//   stock + soldCount (what you have now plus what you have sold), without saving it.
// - Nothing is stored: the value is calculated every time, so adding, editing or deleting an
//   ads entry (or changing the cost or units) changes it straight away. Old orders are never rewritten.

import { ownCost } from './options.js'

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export function effectiveUnits(p) {
  const set = Number(p?.unitsPurchased)
  if (set > 0) return { units: set, isDefault: false }
  return { units: Math.max(0, (Number(p?.stock) || 0) + (Number(p?.soldCount) || 0)), isDefault: true }
}

// { productId: total ad amount }
export async function adTotalsByProduct() {
  const rows = await AdSpend.aggregate([
    { $match: { product: { $ne: null } } },
    { $group: { _id: '$product', total: { $sum: '$amount' } } },
  ])
  return Object.fromEntries(rows.map((r) => [String(r._id), r.total]))
}

export function realCostOf(p, adTotal = 0) {
  const baseCost = Number(p?.costPrice) || 0
  const { units, isDefault } = effectiveUnits(p)
  const adPerUnit = units > 0 ? adTotal / units : 0
  return {
    baseCost: r2(baseCost),
    adSpendTotal: r2(adTotal),
    unitsPurchased: units,
    unitsPurchasedIsDefault: isDefault,
    adPerUnit: r2(adPerUnit),
    realCost: r2(baseCost + adPerUnit),
    // ads were spent but there are no units to spread them over
    needsUnits: adTotal > 0 && units <= 0,
    // combinations with their OWN cost per unit: { "100 ml / Black": 12 } (only those that have one).
    // Their real cost is that cost + the same ads per unit; every other line keeps the product's real cost.
    variantCosts: variantCostsOf(p),
  }
}

function variantCostsOf(p) {
  const out = {}
  for (const v of p?.variants || []) {
    const c = ownCost(v)
    if (c !== null && v.name) out[v.name] = r2(c)
  }
  return out
}

// real cost per unit of one product line: the combination's own cost (when filled in) or the product's
function costOfLine(c, item) {
  const own = item?.variantName ? c.variantCosts?.[item.variantName] : undefined
  return own === undefined ? { realCost: c.realCost, baseCost: c.baseCost } : { realCost: r2(own + c.adPerUnit), baseCost: own }
}

// Map(productId -> realCostOf(...)) for the given ids (or every product)
export async function realCostMap(ids) {
  const valid = ids ? [...new Set(ids.map(String))].filter((id) => mongoose.isValidObjectId(id)) : null
  const [products, ads] = await Promise.all([
    Product.find(valid ? { _id: { $in: valid } } : {}).select('+costPrice stock soldCount unitsPurchased variants.name variants.cost').lean(),
    adTotalsByProduct(),
  ])
  return new Map(products.map((p) => [String(p._id), realCostOf(p, ads[String(p._id)] || 0)]))
}

// cost of one order line: today's real cost of the product, or the cost saved on the order
// when the product has been deleted
export function lineCost(item, costs) {
  const c = costs.get(String(item.product?._id || item.product))
  return c ? costOfLine(c, item).realCost : Number(item.cost) || 0
}

// split of a line cost into base part and ad part (for charts)
export function lineCostParts(item, costs) {
  const c = costs.get(String(item.product?._id || item.product))
  const qty = Number(item.qty) || 0
  if (!c) return { base: (Number(item.cost) || 0) * qty, ad: 0 }
  return { base: costOfLine(c, item).baseCost * qty, ad: c.adPerUnit * qty }
}

// adds realCost to every item of the given (lean) orders, for the admin order screens
export async function withRealCost(orders) {
  const list = Array.isArray(orders) ? orders : [orders]
  const ids = list.flatMap((o) => (o.items || []).map((i) => i.product?._id || i.product)).filter(Boolean)
  const costs = await realCostMap(ids)
  for (const o of list) {
    for (const it of o.items || []) it.realCost = r2(lineCost(it, costs))
  }
  return orders
}
