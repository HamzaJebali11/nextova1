// Unit tests for the admin Planner calculations (client/src/lib/planner.js). Run: cd server && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calc, defaultShares, packRowsFor, rowsOf, DEFAULTS } from '../../../client/src/lib/planner.js'

// costs used in the examples: 20 units x (10 factory + 1 packaging) + 40 shipping = 260 -> landed 13 per unit;
// delivery 20 per order (failed = 20 too), delivery rate 80%, target CPA 70%
const costs = { units: 20, factoryPerUnit: 10, packagingPerUnit: 1, shippingTotal: 40, deliveryPerOrder: 20, deliveryRate: 80, targetPct: 70 }

test('packs 1 / 3 / 5, shares 70 / 20 / 10, prices 35 / 90 / 140 (numbers checked by hand)', () => {
  const r = calc({ ...costs, packRows: [{ size: 1, price: 35, share: 70 }, { size: 3, price: 90, share: 20 }, { size: 5, price: 140, share: 10 }] })
  assert.equal(r.landed, 13)
  assert.equal(r.avgUnits, 1.8) // 0.7x1 + 0.2x3 + 0.1x5
  assert.equal(r.aov, 56.5) // 0.7x35 + 0.2x90 + 0.1x140
  assert.equal(r.main.breakEven, 6.48) // 0.8 x (56.5 - 1.8x13 - 20) - 0.2 x 20
  assert.equal(r.main.target, 4.53) // 70% of 6.48 = 4.536, rounded down
  assert.equal(r.main.profitAtTarget, 1.95)
  assert.equal(r.main.deliveredUnits, 1.44) // 0.8 x 1.8
  assert.equal(r.main.orders, 14) // 20 / 1.44 = 13.89 -> 14
  assert.equal(r.main.budgetTarget, 63.42) // 14 x 4.53
  assert.equal(r.main.budgetBreakEven, 90.72) // 14 x 6.48
  assert.equal(r.main.totalProfit, 27.3) // 14 x 1.95
  assert.deepEqual(r.perUnit.map((u) => [u.pack, u.unitPrice, u.maxAdPerUnit]), [[1, 35, 22], [3, 30, 17], [5, 28, 15]])
  assert.equal(r.mixOk, true)
})

test('a plan saved before (price1..3 / mix1..3) gives exactly the numbers of the old Planner', () => {
  const old = { ...costs, price1: 69, price2: 120, price3: 165, mix1: 75, mix2: 20, mix3: 5 }
  // reference numbers produced by the Planner as it was before this change (git HEAD)
  const want = { landed: 13, avgUnits: 1.3, aov: 84, breakEven: 33.68, target: 23.57, orders: 20, budgetTarget: 471.4, totalProfit: 202.2, perUnit: [[1, 69, 56], [2, 60, 47], [3, 55, 42]] }
  for (const r of [calc(old), calc({ ...old, packRows: rowsOf({ ...DEFAULTS, ...old }) })]) {
    assert.deepEqual([r.landed, r.avgUnits, r.aov, r.main.breakEven, r.main.target, r.main.orders, r.main.budgetTarget, r.main.totalProfit], [want.landed, want.avgUnits, want.aov, want.breakEven, want.target, want.orders, want.budgetTarget, want.totalProfit])
    assert.deepEqual(r.perUnit.map((u) => [u.pack, u.unitPrice, u.maxAdPerUnit]), want.perUnit)
  }
})

test('default shares by number of packs', () => {
  assert.deepEqual(defaultShares(1), [100])
  assert.deepEqual(defaultShares(2), [80, 20])
  assert.deepEqual(defaultShares(3), [75, 20, 5])
  assert.deepEqual(defaultShares(4), [60, 25, 10, 5])
  assert.deepEqual(defaultShares(6), [60, 25, 10, 5, 0, 0])
})

test('rows come from the product: 1 piece + its real packs, sorted, product prices', () => {
  const rows = packRowsFor({ price: 35, packs: [{ qty: 5, price: 140 }, { qty: 3, price: 90, badge: { en: 'Best value' } }] })
  assert.deepEqual(rows.map((r) => [r.size, r.price, r.share, r.label]), [[1, 35, 75, ''], [3, 90, 20, 'Best value'], [5, 140, 5, '']])
  assert.deepEqual(packRowsFor({ price: 50 }).map((r) => [r.size, r.price, r.share]), [[1, 50, 100]])
  assert.deepEqual(packRowsFor({ price: 50, packs: [{ qty: 2, price: 90 }, { qty: 3, price: 120 }, { qty: 6, price: 210 }] }).map((r) => r.share), [60, 25, 10, 5])
})

test('shares not adding up to 100, empty, zero, negative and decimal values', () => {
  const r = calc({ ...costs, packRows: [{ size: 1, price: 35, share: 60 }, { size: 3, price: 90, share: 20 }] })
  assert.equal(r.mixOk, false)
  assert.equal(r.mixTotal, 80)
  const e = calc({ ...costs, packRows: [{ size: 1, price: '', share: '' }, { size: 3, price: -5, share: 100 }] })
  assert.equal(e.aov, 0) // empty and negative prices count as 0, never NaN
  assert.ok(Number.isFinite(e.main.breakEven))
  const d = calc({ ...costs, packRows: [{ size: 1, price: 35.5, share: 33.3 }, { size: 3, price: 90.25, share: 66.7 }] })
  assert.equal(d.mixOk, true)
  assert.ok(Number.isFinite(d.main.totalProfit))
})
