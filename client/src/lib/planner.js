// PLANNER calculations (admin "Planner" page). Pure functions: nothing here touches real data.
// Rounding keeps you on the safe side: costs, orders and budgets round UP; profits and CPAs round DOWN.

export const DEFAULTS = {
  units: '', factoryPerUnit: '', packagingPerUnit: '', cartons: '', unitsPerCarton: '', kgPerCarton: '',
  shippingTotal: '', shippingPerKg: '', deliveryPerOrder: '', failedCost: '', otherCosts: '',
  price1: '', price2: '', price3: '', mix1: 75, mix2: 20, mix3: 5, deliveryRate: 80, targetPct: 70,
}

const num = (v) => Math.max(0, Number(v) || 0) // empty = 0
const up = (n) => Math.ceil(n * 100 - 1e-9) / 100
const down = (n) => Math.floor(n * 100 + 1e-9) / 100
export const DELIVERY_RATES = [70, 80, 90]

// Default shares of orders by number of pack rows (all editable): 1 row 100; 2 rows 80/20; 3 rows 75/20/5
// (as before); 4 or more: 60/25/10/5 for the first four, then 0.
export function defaultShares(n) {
  if (n <= 1) return [100]
  if (n === 2) return [80, 20]
  if (n === 3) return [75, 20, 5]
  return Array.from({ length: n }, (_, i) => [60, 25, 10, 5][i] ?? 0)
}

// The rows of the "Pack prices and sales mix" box for a product: 1 piece (the product price) + every pack the
// product really has, sorted by size, prices prefilled from the product (planner only, never saved to it).
// A product with option prices (price per size) uses the product's base price (see note on the page).
export function packRowsFor(product) {
  const price = Number(product?.price) || 0
  const packs = (product?.packs || []).filter((p) => Number(p.qty) > 1).sort((a, b) => Number(a.qty) - Number(b.qty))
  const seen = new Set([1])
  const rows = [{ size: 1, price: price || '', label: '' }]
  for (const p of packs) {
    const q = Number(p.qty)
    if (seen.has(q)) continue
    seen.add(q)
    rows.push({ size: q, price: Number(p.price) >= 0 ? Number(p.price) : '', label: p.badge?.en || '' })
  }
  const shares = defaultShares(rows.length)
  return rows.map((r, i) => ({ ...r, share: shares[i] }))
}

// does the product have option prices (price per size)? (the planner then uses the base price)
export const hasOptionPrices = (product) => (product?.variants || []).some((v) => Number(v.price) > 0)

// pack prices prefilled from the product's own packs (planner only, never saved to the product)
export function defaultsFor(product) {
  const price = Number(product?.price) || 0
  const pack = (q) => product?.packs?.find((p) => Number(p.qty) === q)?.price
  return {
    ...DEFAULTS, price1: price || '', price2: pack(2) ?? (price ? price * 2 : ''), price3: pack(3) ?? (price ? price * 3 : ''),
    packRows: packRowsFor(product),
  }
}

// A plan saved before the real pack rows (Step 46) has only price1..3 / mix1..3: it becomes rows of 1, 2 and 3
// pieces with exactly those numbers (in memory only; the saved document is not changed until you press Save).
export function rowsOf(input) {
  const i = { ...DEFAULTS, ...input }
  if (Array.isArray(i.packRows) && i.packRows.length) return i.packRows
  return [1, 2, 3].map((n) => ({ size: n, price: i[`price${n}`], share: i[`mix${n}`], label: '' }))
}

export function calc(input) {
  const i = { ...DEFAULTS, ...input }
  const U = num(i.units)
  const cartons = num(i.cartons)
  const totalKg = cartons * num(i.kgPerCarton)
  const cartonUnits = cartons * num(i.unitsPerCarton)
  const shipping = num(i.shippingPerKg) > 0 ? totalKg * num(i.shippingPerKg) : num(i.shippingTotal)
  const other = num(i.otherCosts)

  // landed cost per unit = (factory + packaging + China shipping + other) / total units
  const totalCost = num(i.factoryPerUnit) * U + num(i.packagingPerUnit) * U + shipping + other
  const landed = U > 0 ? up(totalCost / U) : 0

  // the pack rows: the product's real packs (or 1 / 2 / 3 for plans saved before)
  const rows = rowsOf(i)
  const sizes = rows.map((r) => Math.max(1, Math.floor(num(r.size)) || 1))
  const prices = rows.map((r) => num(r.price))
  const mix = rows.map((r) => num(r.share))
  const mixTotal = Math.round(mix.reduce((a, b) => a + b, 0) * 1000) / 1000
  const share = mix.map((m) => m / 100)
  const avgUnits = share.reduce((sum, s, k) => sum + s * sizes[k], 0)
  const aov = share.reduce((sum, s, k) => sum + s * prices[k], 0)

  const D = num(i.deliveryPerOrder)
  const F = i.failedCost === '' || i.failedCost === null || i.failedCost === undefined ? D : num(i.failedCost)
  const t = num(i.targetPct) / 100

  // profit per PLACED order before ads at delivery rate d (returned units go back to stock)
  const atRate = (pct) => {
    const d = pct / 100
    const beforeAds = d * (aov - avgUnits * landed - D) - (1 - d) * F
    const breakEven = down(beforeAds)
    const target = breakEven > 0 ? down(t * breakEven) : 0
    const profitAtTarget = breakEven > 0 ? down(breakEven - target) : breakEven
    const deliveredUnits = d * avgUnits
    const ordersRaw = deliveredUnits > 0 && U > 0 ? U / deliveredUnits : 0
    const orders = Math.ceil(ordersRaw - 1e-9)
    return {
      pct, breakEven, target, profitAtTarget,
      deliveredUnits: Math.round(deliveredUnits * 1000) / 1000,
      ordersRaw: Math.round(ordersRaw * 10) / 10,
      orders,
      budgetTarget: up(orders * target),
      budgetBreakEven: up(orders * Math.max(0, breakEven)),
      totalProfit: down(orders * profitAtTarget),
    }
  }

  const main = atRate(num(i.deliveryRate))
  const perUnit = prices.map((p, k) => {
    const unitPrice = p / sizes[k]
    return { pack: sizes[k], label: rows[k].label || '', price: p, unitPrice: down(unitPrice), maxAdPerUnit: down(unitPrice - landed) }
  })

  // green = healthy, amber = thin (break-even CPA under 15% of the order value), red = no profit possible
  const status = main.breakEven <= 0 ? 'red' : aov > 0 && main.breakEven < 0.15 * aov ? 'amber' : 'green'

  return {
    U, totalKg, cartonUnits, cartonsMismatch: cartons > 0 && cartonUnits !== U, shipping: up(shipping), other,
    totalCost: up(totalCost), landed, sizes, prices, mix, mixTotal, mixOk: Math.abs(mixTotal - 100) < 0.001,
    avgUnits: Math.round(avgUnits * 1000) / 1000, aov: down(aov), D, F, targetPct: num(i.targetPct),
    main, rates: DELIVERY_RATES.map(atRate), perUnit, status,
  }
}
