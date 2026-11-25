// DELIVERY ROUTE ORDER (same rules as server/src/utils/deliveryRoute.js, so the Excel export matches the screen)
//
// mode 'route' (default): zones in NUMBER order (2 before 10, never 1 → 20 → 1), orders without a zone last;
//   inside a zone: oldest order first, then street, then building (numeric).
// mode 'oldest': every order by date, oldest first.
// pinOverdue: zones that have an order older than 2 days come first (still in number order among themselves).

export const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000

const numOrInf = (v) => {
  const m = String(v ?? '').match(/\d+/)
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY
}
const natural = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
const time = (o) => new Date(o.createdAt).getTime()

export const isOverdue = (o, now = Date.now()) => now - time(o) > OVERDUE_MS
export const zoneKey = (o) => String(o.customer?.zone ?? '').trim()

export function routeSort(list, { mode = 'route', pinOverdue = false, now = Date.now() } = {}) {
  const out = [...list]
  if (mode === 'oldest') return out.sort((a, b) => time(a) - time(b))

  const overdueZones = new Set(pinOverdue ? out.filter((o) => isOverdue(o, now)).map(zoneKey) : [])
  return out.sort((a, b) => {
    const za = zoneKey(a)
    const zb = zoneKey(b)
    if (pinOverdue) {
      const pa = overdueZones.has(za) ? 0 : 1
      const pb = overdueZones.has(zb) ? 0 : 1
      if (pa !== pb) return pa - pb
    }
    return (
      numOrInf(za) - numOrInf(zb) ||
      natural(za, zb) ||
      time(a) - time(b) ||
      natural(a.customer?.street, b.customer?.street) ||
      natural(a.customer?.building, b.customer?.building)
    )
  })
}

// "Products to prepare": units per product and option. In this store a pack is already stored as
// its number of units (2 packs = qty 2), so units = quantity on the order line. Free gifts are listed too.
export function productsToPrepare(list) {
  const map = new Map()
  for (const o of list) {
    for (const it of o.items || []) {
      const gift = it.price === 0
      const name = String(it.name || '').replace(/ \(free gift\)$/, '')
      const key = `${name}|${it.variantName || ''}|${gift ? 'gift' : ''}`
      const row = map.get(key) || { name, variant: it.variantName || '', gift, units: 0, orders: 0 }
      row.units += Number(it.qty) || 0
      row.orders += 1
      map.set(key, row)
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name) || natural(a.variant, b.variant) || Number(a.gift) - Number(b.gift))
}
