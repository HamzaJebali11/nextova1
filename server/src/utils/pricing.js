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