// Unit tests for the pack prices (run: cd server && npm test). Node's built-in test runner, no package needed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestTotal, priceFor, packPlan, MAX_LINE } from './pricing.js'
import * as client from '../../../client/src/lib/pricing.js'

const packs12 = [{ qty: 2, price: 120 }]

test('example: 1 = 69, 2-pack = 120 -> 3 = 189, 4 = 240, 5 = 309', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => priceFor(n, 69, packs12)), [69, 120, 189, 240, 309])
  assert.deepEqual(packPlan(3, 69, packs12), [{ size: 2, count: 1 }, { size: 1, count: 1 }])
  assert.deepEqual(packPlan(4, 69, packs12), [{ size: 2, count: 2 }])
})

test('packs 1, 2, 3 and packs 1 and 3 only', () => {
  const p123 = [{ qty: 2, price: 90 }, { qty: 3, price: 120 }]
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => priceFor(n, 50, p123)), [50, 90, 120, 170, 210, 240, 290])
  const p13 = [{ qty: 3, price: 130 }]
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => priceFor(n, 50, p13)), [50, 100, 130, 180, 230, 260])
})

test('no packs: plain price x quantity', () => {
  for (let n = 1; n <= 20; n++) assert.equal(priceFor(n, 37.5, []), Math.round(37.5 * n * 100) / 100)
})

test('up to the largest pack nothing changes (same as before for every quantity)', () => {
  for (let i = 0; i < 2000; i++) {
    const base = 1 + Math.floor(Math.random() * 200)
    const packs = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({ qty: 2 + Math.floor(Math.random() * 5), price: Math.floor(Math.random() * base * 6) }))
    const largest = Math.max(...packs.map((p) => p.qty))
    for (let n = 1; n <= largest; n++) assert.equal(priceFor(n, base, packs), bestTotal(n, base, packs))
  }
})

test('above the largest pack, more pieces never cost less than fewer', () => {
  for (let i = 0; i < 400; i++) {
    const base = 1 + Math.floor(Math.random() * 200)
    const packs = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({ qty: 2 + Math.floor(Math.random() * 5), price: Math.floor(Math.random() * base * 6) }))
    const largest = Math.max(...packs.map((p) => p.qty))
    // from the largest pack + 1 on (up to the largest pack the prices are yours and stay exactly as today)
    for (let n = largest + 1; n < 30; n++) assert.ok(priceFor(n + 1, base, packs) >= priceFor(n, base, packs), JSON.stringify({ base, packs, n }))
  }
})

test('unusual packs (1 = 100, 3-pack = 150): above the largest pack the price follows the rule', () => {
  const p = [{ qty: 3, price: 150 }]
  assert.equal(bestTotal(5, 100, p), 350) // 3 + 1 + 1 exactly
  assert.equal(priceFor(5, 100, p), 300) // never more than 6 pieces (3 + 3 = 300)
  assert.equal(packPlan(5, 100, p), null) // the shop then shows only the price, no breakdown
  assert.equal(priceFor(2, 100, p), 200) // up to the largest pack: unchanged
})

test('client and server give identical prices and breakdowns', () => {
  for (let i = 0; i < 500; i++) {
    const base = Math.round(Math.random() * 20000) / 100
    const packs = Array.from({ length: Math.floor(Math.random() * 4) }, () => ({ qty: 2 + Math.floor(Math.random() * 6), price: Math.round(Math.random() * base * 700) / 100 }))
    for (const n of [1, 2, 3, 5, 8, 13, 21, 40]) {
      assert.equal(client.priceFor(n, base, packs), priceFor(n, base, packs))
      assert.deepEqual(client.packPlan(n, base, packs), packPlan(n, base, packs))
    }
  }
  assert.equal(client.MAX_LINE, MAX_LINE)
})
