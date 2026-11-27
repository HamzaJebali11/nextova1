// Product form <-> product data for OPTION TYPES (Size, Color) and their combinations.
// Each combination is saved as one variant named with its English values joined by " / " ("100 ml / Black"),
// so stock, orders and every printout keep working by name, exactly like the older variants.
// Numbers are kept per combination name: adding or removing a value keeps what was typed for the others.

export const SEP = ' / '

const num = (v) => (v === '' || v === null || v === undefined ? '' : v)

// form state from a saved product
export function optionsToForm(p) {
  const types = (p?.optionTypes || []).map((t) => ({
    name: { en: t.name?.en || '', ar: t.name?.ar || '' },
    values: (t.values || []).map((v) => ({ en: v.en || '', ar: v.ar || '', image: v.image || '', saved: true })),
  }))
  const combos = {}
  if (types.length) {
    for (const v of p.variants || []) {
      combos[v.name] = {
        stock: v.stock ?? 0, price: num(v.price), compareAtPrice: num(v.compareAtPrice), cost: num(v.cost),
        enabled: v.enabled !== false, sku: v.sku || '', saved: true,
      }
    }
  }
  return { optionTypes: types, combos }
}

// every combination of the values (one value of each type), in order
export function combinationsOf(types) {
  const lists = types.map((t) => t.values.map((v) => v.en.trim()).filter(Boolean))
  if (!lists.length || lists.some((l) => !l.length)) return []
  let out = [[]]
  for (const l of lists) out = out.flatMap((prefix) => l.map((v) => [...prefix, v]))
  return out.map((values) => ({ name: values.join(SEP), values }))
}

export const blankCombo = () => ({ stock: 0, price: '', compareAtPrice: '', cost: '', enabled: true, sku: '' })

// the picture of a combination: the first of its values that has one
function imageOf(types, values) {
  for (let i = 0; i < types.length; i++) {
    const img = types[i].values.find((v) => v.en.trim() === values[i])?.image
    if (img) return img
  }
  return undefined
}

const optNum = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? undefined : Number(v))

// what is sent to the server: the option types and one variant per combination
export function optionsPayload(f) {
  const types = f.optionTypes
    .map((t) => ({
      name: { en: t.name.en.trim(), ar: t.name.ar.trim() || undefined },
      values: t.values.filter((v) => v.en.trim()).map((v) => ({ en: v.en.trim(), ar: v.ar.trim() || undefined, image: v.image || undefined })),
    }))
  const variants = combinationsOf(f.optionTypes).map(({ name, values }) => {
    const c = f.combos[name] || blankCombo()
    return {
      name,
      options: values.map((value, i) => ({ type: types[i].name.en, value })),
      stock: Math.max(0, Math.round(Number(c.stock) || 0)),
      price: optNum(c.price) > 0 ? optNum(c.price) : undefined, // empty = the product price
      compareAtPrice: optNum(c.compareAtPrice) > 0 ? optNum(c.compareAtPrice) : undefined,
      cost: optNum(c.cost), // empty = the product cost
      enabled: c.enabled === false ? false : undefined, // empty = on
      sku: c.sku || undefined,
      image: imageOf(types, values),
    }
  })
  return { optionTypes: types, variants }
}

// start option types from an older plain variant list: one type, the same names (so nothing is lost)
export function fromOldVariants(variants) {
  const combos = {}
  for (const v of variants) {
    if (!v.name.trim()) continue
    combos[v.name.trim()] = { ...blankCombo(), stock: v.stock ?? 0, price: num(v.price), saved: true }
  }
  return {
    optionTypes: [{
      name: { en: 'Option', ar: '' },
      values: variants.filter((v) => v.name.trim()).map((v) => ({ en: v.name.trim(), ar: '', image: v.image || '', saved: true })),
    }],
    combos,
  }
}
