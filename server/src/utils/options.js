// Products with option types (Size, Color): every variant is one combination named "100 ml / Black".
// Older products (no optionTypes) are never touched by anything here.

export const SEP = ' / '

export const hasOptionTypes = (p) => Array.isArray(p?.optionTypes) && p.optionTypes.length > 0

// the variant is switched on (older variants have no "enabled" field: on)
export const isOn = (v) => v?.enabled !== false

// own cost per unit of a combination, or null when it is empty (then the product cost is used)
export function ownCost(v) {
  const c = v?.cost
  return c === null || c === undefined || c === '' || !Number.isFinite(Number(c)) ? null : Number(c)
}

// what the order line saves for a combination: [{ type, value }] and the Arabic name, when there is one
export function comboDetails(product, variant) {
  if (!hasOptionTypes(product) || !variant) return {}
  const opts = (variant.options || []).map((o) => ({ type: o.type, value: o.value }))
  if (!opts.length) return {}
  const ar = opts.map((o) => {
    const t = product.optionTypes.find((x) => x.name?.en === o.type)
    const val = t?.values?.find((x) => x.en === o.value)
    return val?.ar || o.value
  })
  const variantNameAr = ar.join(SEP)
  return { options: opts, variantNameAr: variantNameAr !== variant.name ? variantNameAr : undefined }
}

// checks one order line of a product with option types. Returns an error (status, EN, AR) or null.
export function comboProblem(product, variant, wantedName) {
  if (!hasOptionTypes(product)) return null
  const names = product.optionTypes.map((t) => t.name?.en).filter(Boolean)
  const namesAr = product.optionTypes.map((t) => t.name?.ar || t.name?.en).filter(Boolean)
  if (!wantedName || !variant) {
    return {
      status: 400,
      en: `Please choose ${names.join(' and ')} for ${product.name.en}`,
      ar: `يرجى اختيار ${namesAr.join(' و')} لـ ${product.name.ar || product.name.en}`,
    }
  }
  if ((variant.options || []).length !== product.optionTypes.length || !isOn(variant)) {
    return {
      status: 409,
      en: `Sorry, ${product.name.en} (${variant.name}) is not available. Please choose another option.`,
      ar: `عذراً، ${product.name.ar || product.name.en} (${comboDetails(product, variant).variantNameAr || variant.name}) غير متوفر. يرجى اختيار خيار آخر.`,
    }
  }
  return null
}

// lowest and highest price of the switched-on combinations (empty price = the product price)
export function priceRange(p) {
  const list = hasOptionTypes(p) ? (p.variants || []).filter(isOn) : []
  if (!list.length) return { min: p.price, max: p.price }
  const prices = list.map((v) => (Number(v.price) > 0 ? Number(v.price) : p.price))
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

// checks a product sent by the admin (only products with option types). Returns a message or null.
export function optionTypesProblem(body) {
  const types = body?.optionTypes
  if (!Array.isArray(types) || types.length === 0) return null
  if (types.length > 2) return 'At most 2 option types'
  for (const t of types) {
    if (!String(t?.name?.en || '').trim()) return 'Each option type needs an English name'
    const vals = (t.values || []).map((v) => String(v?.en || '').trim())
    if (!vals.length) return `Add at least one value to ${t.name.en}`
    if (vals.some((v) => !v)) return `Each value of ${t.name.en} needs an English name`
    if (vals.some((v) => v.includes('/'))) return 'Values cannot contain "/"'
    if (new Set(vals.map((v) => v.toLowerCase())).size !== vals.length) return `${t.name.en} has the same value twice`
  }
  const names = (body.variants || []).map((v) => v?.name)
  if (new Set(names).size !== names.length) return 'Two combinations have the same name'
  for (const v of body.variants || []) {
    const opts = v.options || []
    if (opts.length !== types.length || opts.map((o) => o.value).join(SEP) !== v.name) return `Combination "${v.name}" does not match its options`
  }
  return null
}
