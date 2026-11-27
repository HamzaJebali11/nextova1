import Product from '../modules/products/product.model.js'
import Category from '../modules/categories/category.model.js'

// Storefront search: English + Arabic names, categories, tags and SKU.
//  - Arabic: diacritics and tatweel removed; alef / hamza forms, ta marbuta and alef maqsura made equal
//  - Latin: lower case, accents removed; extra spaces ignored
//  - small typos tolerated (1 letter for words of 4-7 letters, 2 for longer words)
//  - ranking: whole name starts with the search > a word starts with it > contains > typo; in stock first
// The product list is kept in memory (refreshed every 5 minutes, or at once after a product is changed),
// and recent searches are cached for 60 seconds.

export function normalize(text = '') {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')            // Latin accents
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '') // Arabic diacritics
    .replace(/ـ/g, '')                                        // tatweel
    .replace(/[إأآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ء/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// typo distance: insert, delete, replace, or swap two neighbour letters ("lmap" -> "lamp") = 1 each
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      best = Math.min(best, d[i][j])
    }
    if (best > max) return max + 1
  }
  return d[a.length][b.length]
}
const allowedTypos = (w) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0)

let index = null
let builtAt = 0
const TTL = 5 * 60 * 1000
const cache = new Map()

export function invalidateSearch() { index = null; cache.clear() }

async function getIndex() {
  if (index && Date.now() - builtAt < TTL) return index
  const [products, cats] = await Promise.all([
    Product.find({ isActive: true }).select('name slug sku tags category price compareAtPrice stock images soldCount bestSeller packs ratingAvg ratingCount optionTypes variants.price variants.enabled').lean(),
    Category.find().select('name parent').lean(),
  ])
  const catName = new Map(cats.map((c) => [String(c._id), normalize(`${c.name?.en || ''} ${c.name?.ar || ''}`)]))
  index = products.map((p) => {
    const en = normalize(p.name?.en)
    const ar = normalize(p.name?.ar)
    return {
      p,
      names: [en, ar].filter(Boolean),
      words: new Set(`${en} ${ar}`.split(' ').filter(Boolean)),
      other: normalize(`${catName.get(String(p.category)) || ''} ${(p.tags || []).join(' ')} ${p.sku || ''}`),
      otherWords: new Set(normalize(`${catName.get(String(p.category)) || ''} ${(p.tags || []).join(' ')} ${p.sku || ''}`).split(' ').filter(Boolean)),
    }
  })
  builtAt = Date.now()
  cache.clear()
  return index
}

function tokenScore(tok, words, text, weight) {
  if (!tok) return 0
  let best = 0
  for (const w of words) {
    if (w === tok) best = Math.max(best, 70)
    else if (w.startsWith(tok)) best = Math.max(best, 60)
    else if (w.includes(tok) && tok.length >= 2) best = Math.max(best, 40)
    else {
      const max = allowedTypos(tok)
      if (max && editDistance(tok, w.slice(0, tok.length + max), max) <= max) best = Math.max(best, 25)
    }
  }
  if (!best && tok.length >= 2 && text.includes(tok)) best = 35
  return best * weight
}

// ranked list of { product, score } (all matches, best first)
export async function searchProducts(query) {
  const q = normalize(query).slice(0, 80)
  if (!q) return []
  const hit = cache.get(q)
  if (hit && Date.now() - hit.at < 60 * 1000) return hit.list
  const idx = await getIndex()
  const tokens = q.split(' ').slice(0, 6)
  const out = []
  for (const e of idx) {
    let score = 0
    let all = true
    for (const t of tokens) {
      const s = Math.max(tokenScore(t, e.words, e.names.join(' '), 1), tokenScore(t, e.otherWords, e.other, 0.6))
      if (!s) { all = false; break }
      score += s
    }
    if (!all) continue
    if (e.names.some((n) => n.startsWith(q))) score += 100
    else if (e.names.some((n) => n.includes(q))) score += 30
    out.push({ product: e.p, score, inStock: (e.p.stock || 0) > 0 })
  }
  out.sort((a, b) => (b.inStock - a.inStock) || (b.score - a.score) || ((b.product.soldCount || 0) - (a.product.soldCount || 0)))
  if (cache.size > 300) cache.delete(cache.keys().next().value)
  cache.set(q, { at: Date.now(), list: out })
  return out
}
