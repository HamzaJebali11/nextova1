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

// how many free gift units a cart item earns
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