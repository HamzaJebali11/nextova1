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

// pack prices prefilled from the product's own packs (planner only, never saved to the product)
export function defaultsFor(product) {
  const price = Number(product?.price) || 0
  const pack = (q) => product?.packs?.find((p) => Number(p.qty) === q)?.price
  return { ...DEFAULTS, price1: price || '', price2: pack(2) ?? (price ? price * 2 : ''), price3: pack(3) ?? (price ? price * 3 : '') }
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

  const prices = [num(i.price1), num(i.price2), num(i.price3)]
  const mix = [num(i.mix1), num(i.mix2), num(i.mix3)]
  const mixTotal = mix[0] + mix[1] + mix[2]
  const share = mix.map((m) => m / 100)
  const avgUnits = share[0] * 1 + share[1] * 2 + share[2] * 3
  const aov = share[0] * prices[0] + share[1] * prices[1] + share[2] * prices[2]

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
    const unitPrice = p / (k + 1)
    return { pack: k + 1, price: p, unitPrice: down(unitPrice), maxAdPerUnit: down(unitPrice - landed) }
  })

  // green = healthy, amber = thin (break-even CPA under 15% of the order value), red = no profit possible
  const status = main.breakEven <= 0 ? 'red' : aov > 0 && main.breakEven < 0.15 * aov ? 'amber' : 'green'

  return {
    U, totalKg, cartonUnits, cartonsMismatch: cartons > 0 && cartonUnits !== U, shipping: up(shipping), other,
    totalCost: up(totalCost), landed, prices, mix, mixTotal, mixOk: Math.abs(mixTotal - 100) < 0.001,
    avgUnits: Math.round(avgUnits * 1000) / 1000, aov: down(aov), D, F, targetPct: num(i.targetPct),
    main, rates: DELIVERY_RATES.map(atRate), perUnit, status,
  }
}
