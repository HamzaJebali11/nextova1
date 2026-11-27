// ======================================================================================================
// PACK PRICES. This block is IDENTICAL in client/src/lib/pricing.js and server/src/utils/pricing.js
// (the server's numbers are the ones that count; the shop shows the same numbers).
// ======================================================================================================

// Cheapest way to buy exactly `qty` units: single units at `base`, or any mix of pack offers.
// packs: [{ qty, price }] where price is the TOTAL for that many units.
export function bestTotal(qty, base, packs = []) {
  const offers = (packs || []).filter((p) => Number(p.qty) > 1 && Number(p.price) >= 0)
  const dp = [0]
  for (let n = 1; n <= qty; n++) {
    let best = dp[n - 1] + base
    for (const p of offers) {
      if (p.qty <= n) best = Math.min(best, dp[n - p.qty] + p.price)
    }
    dp[n] = best
  }
  return Math.round(dp[qty] * 100) / 100
}

// the most pieces of one product in one order line (a technical ceiling; the shop's own limit is the
// "Maximum pieces per order" setting, and the stock)
export const MAX_LINE = 100

// Price of `qty` pieces (Step 45). Up to the largest pack: exactly bestTotal (unchanged). Above the largest
// pack: never more than the price of buying MORE pieces (more pieces may never cost less than fewer), so
// price(qty) = the cheapest exact price of any quantity from qty up to MAX_LINE. With usual packs (a bigger
// pack is never cheaper in total than a smaller quantity) this is simply bestTotal.
export function priceFor(qty, base, packs = []) {
  const n = Math.max(0, Math.floor(Number(qty) || 0))
  const offers = (packs || []).filter((p) => Number(p.qty) > 1 && Number(p.price) >= 0)
  const largest = offers.reduce((m, p) => Math.max(m, Number(p.qty)), 1)
  if (n <= largest) return bestTotal(n, base, packs)
  const top = Math.max(n, MAX_LINE)
  let best = bestTotal(top, base, packs)
  for (let m = top - 1; m >= n; m--) best = Math.min(best, bestTotal(m, base, packs))
  return best
}

// How `qty` pieces are made of packs, for display: [{ size, count }] (largest pack first; size 1 = single
// pieces), or null when the price of `qty` comes from a larger quantity (unusual pack prices).
export function packPlan(qty, base, packs = []) {
  const n = Math.max(0, Math.floor(Number(qty) || 0))
  const offers = (packs || []).filter((p) => Number(p.qty) > 1 && Number(p.price) >= 0)
  if (priceFor(n, base, packs) !== bestTotal(n, base, packs)) return null
  const dp = [0], from = [0]
  for (let k = 1; k <= n; k++) {
    let best = dp[k - 1] + base, size = 1
    for (const p of offers) {
      if (p.qty <= k && dp[k - p.qty] + p.price < best) { best = dp[k - p.qty] + p.price; size = Number(p.qty) }
    }
    dp[k] = best
    from[k] = size
  }
  const count = {}
  for (let k = n; k > 0; k -= from[k]) count[from[k]] = (count[from[k]] || 0) + 1
  return Object.entries(count).map(([size, c]) => ({ size: Number(size), count: c })).sort((a, b) => b.size - a.size)
}

// Prices a whole list of lines (cart or product page).
// Lines of the SAME product share the pack offers, so 1 red + 1 blue counts as 2 for "2 packs".
// A line with poolable === false (a variant with its own price) is sold at its own price.
// The first line of a product also carries giftQty (free gift units earned by the whole product).
export function repriceCart(items) {
  const pooled = {}
  const total = {}
  for (const i of items) {
    total[i.productId] = (total[i.productId] || 0) + i.qty
    if (i.poolable !== false) pooled[i.productId] = (pooled[i.productId] || 0) + i.qty
  }

  const unit = {}
  for (const i of items) {
    if (i.poolable === false || unit[i.productId] !== undefined) continue
    const n = pooled[i.productId]
    unit[i.productId] = priceFor(n, i.base ?? i.price, i.packs || []) / n
  }

  const seen = new Set()
  return items.map((i) => {
    const base = i.base ?? i.price
    let giftQty = 0
    if (i.gift && !seen.has(i.productId)) {
      seen.add(i.productId)
      giftQty = Math.floor(total[i.productId] / (i.gift.minQty || 1)) * (i.gift.qty || 1)
    }
    return { ...i, base, price: i.poolable === false ? base : unit[i.productId], giftQty }
  })
}

// how many free gift units a single cart item earns (older carts)
export const giftCount = (item) =>
  item?.gift ? Math.floor(item.qty / (item.gift.minQty || 1)) * (item.gift.qty || 1) : 0

export function packLabel(n, lang) {
  if (lang === 'ar') {
    if (n === 1) return 'عبوة واحدة'
    if (n === 2) return 'عبوتان'
    if (n <= 10) return `${n} عبوات`
    return `${n} عبوة`
  }
  return `${n} ${n === 1 ? 'pack' : 'packs'}`
}

// the most pieces of one cart line the + buttons allow: "Maximum pieces per order" (Settings; 0 = MAX_LINE).
// (The server checks it again, per product, and the stock.)
export const cartMax = (settings) => {
  const n = Number(settings?.maxPerOrder ?? 10)
  return n > 0 ? Math.min(n, MAX_LINE) : MAX_LINE
}
