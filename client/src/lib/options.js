// Products with option types (Size, Color): each variant is one combination named "100 ml / Black"
// (English values joined with " / "). Older products have no optionTypes and are not changed by anything here.
// Display helpers only: the server decides every price and checks every combination.

export const SEP = ' / '

export const optionTypesOf = (p) => (Array.isArray(p?.optionTypes) ? p.optionTypes.filter((t) => t?.values?.length) : [])
export const hasOptionTypes = (p) => optionTypesOf(p).length > 0

// switched on (older variants have no "enabled" field: on)
export const isOn = (v) => v?.enabled !== false

// the combination for the chosen English values (one per type), or undefined
export const comboOf = (p, values) =>
  values.every(Boolean) ? (p.variants || []).find((v) => v.name === values.join(SEP)) : undefined

// the values of a combination name, in option-type order
export const valuesOf = (name) => (name ? String(name).split(SEP) : [])

// unit price of a variant: its own price, else the product price
export const unitPriceOf = (p, v) => (v && Number(v.price) > 0 ? Number(v.price) : Number(p.price) || 0)

// the "was" price of one unit: the combination's own one, else the product's when the combination uses the product price
export function compareAtOf(p, v) {
  if (v && Number(v.compareAtPrice) > 0) return Number(v.compareAtPrice)
  if (v && Number(v.price) > 0) return 0 // own price without its own "was" price: no saving shown
  return Number(p.compareAtPrice) || 0
}

// lowest / highest price of the switched-on combinations (products with option types only)
export function priceRange(p) {
  if (Number.isFinite(p?.priceMin) && Number.isFinite(p?.priceMax)) return { min: p.priceMin, max: p.priceMax }
  const list = hasOptionTypes(p) ? (p.variants || []).filter(isOn) : []
  if (!list.length) return { min: p?.price, max: p?.price }
  const prices = list.map((v) => unitPriceOf(p, v))
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

// "From QAR 50" when the combinations have different prices, else the normal price
export function priceText(p, money, t) {
  const { min, max } = priceRange(p)
  return min !== max ? t('fromPrice').replace('{amt}', money(min)) : money(min)
}

// label of one value / of a whole combination in the visitor's language
export function valueLabel(type, value, lang) {
  const v = type?.values?.find((x) => x.en === value)
  return (lang === 'ar' && v?.ar) || value
}
export function typeLabel(type, lang) {
  return (lang === 'ar' && type?.name?.ar) || type?.name?.en || ''
}
export function comboLabel(p, name, lang) {
  const types = optionTypesOf(p)
  if (!types.length || !name) return name || ''
  return valuesOf(name).map((val, i) => valueLabel(types[i], val, lang)).join(SEP)
}
// both languages, saved on the cart line (the cart shows the visitor's language)
export const comboLabels = (p, name) => ({ en: comboLabel(p, name, 'en'), ar: comboLabel(p, name, 'ar') })
