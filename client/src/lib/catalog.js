import { api } from './api'

// Active products, loaded ONCE per visit and only when first needed (menu hover, cart, thank-you page),
// so the first page load is never slowed. The public list returns active products only (max 48, newest first).
let promise = null

export function loadCatalog() {
  if (!promise) {
    promise = api('/products?limit=48&sort=newest')
      .then((d) => d.items || [])
      .catch(() => {
        promise = null // try again next time
        return []
      })
  }
  return promise
}

const idOf = (v) => String(v?._id || v || '')

// products of a category (and its sub-categories), in-stock first, up to `max`
export function productsOf(all, category, categories, max = 8) {
  const ids = category
    ? new Set([idOf(category), ...categories.filter((c) => idOf(c.parent) === idOf(category)).map(idOf)])
    : null
  const list = all.filter((p) => !ids || ids.has(idOf(p.category)))
  return [...list.filter((p) => p.stock > 0), ...list.filter((p) => !(p.stock > 0))].slice(0, max)
}

// cart line for a quick "Add" (one unit), same shape as the product page, so the EXISTING cart
// pricing code prices it (pack prices included). Products with options need their page.
export function cartLineFor(p) {
  const packs = (p.packs || []).map(({ qty, price }) => ({ qty, price }))
  return {
    productId: p._id,
    slug: p.slug,
    name: p.name,
    image: p.images?.[0]?.url,
    qty: 1,
    base: p.price,
    price: p.price,
    packs,
    poolable: true,
    gift: null,
  }
}
