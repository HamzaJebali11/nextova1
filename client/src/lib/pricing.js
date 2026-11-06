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
    unit[i.productId] = bestTotal(n, i.base ?? i.price, i.packs || []) / n
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