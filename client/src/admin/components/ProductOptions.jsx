import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { blankCombo, combinationsOf, fromOldVariants } from './optionsForm'

const inputCls = 'w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-gray-900'
const cellCls = 'w-full min-w-[4.5rem] rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gray-900'
const r2 = (n) => Math.round(n * 100) / 100

// OPTIONS: up to 2 option types (Size, Color), each with values (EN / AR, optional picture).
// With 2 types every Size x Color pair gets a row (stock, price, on/off, cost). With 1 type: one row per value,
// like the older variant list. Nothing is saved until "Save product"; removing a value that has stock or
// open orders always asks first.
export default function ProductOptions({ f, setF, productId, images, basePrice }) {
  const types = f.optionTypes
  const [usage, setUsage] = useState({}) // open orders per combination name (read only)
  const [draft, setDraft] = useState({}) // the "add a value" text of each type
  const [bulk, setBulk] = useState({ stock: '', price: '', value: '', valuePrice: '' })

  useEffect(() => {
    if (!productId) return
    api(`/products/${productId}/variant-usage`).then(setUsage).catch(() => {})
  }, [productId])

  const combos = useMemo(() => combinationsOf(types), [types])
  const rowOf = (name) => f.combos[name] || blankCombo()

  const setTypes = (fn) => setF((s) => ({ ...s, optionTypes: fn(s.optionTypes) }))
  const setCombo = (name, patch) => setF((s) => ({ ...s, combos: { ...s.combos, [name]: { ...(s.combos[name] || blankCombo()), ...patch } } }))
  const setAll = (names, patch) => setF((s) => {
    const next = { ...s.combos }
    for (const n of names) next[n] = { ...(next[n] || blankCombo()), ...(typeof patch === 'function' ? patch(next[n] || blankCombo()) : patch) }
    return { ...s, combos: next }
  })

  // stock and open orders of the combinations that would disappear
  function at(names) {
    const stock = names.reduce((n, k) => n + (Number(f.combos[k]?.stock) || 0), 0)
    const orders = names.reduce((n, k) => n + (usage[k] || 0), 0)
    return { stock, orders }
  }
  function askToRemove(what, names) {
    const { stock, orders } = at(names)
    if (!stock && !orders) return true
    return window.confirm(`${what} still has ${stock} unit(s) in stock${orders ? ` and ${orders} open order(s)` : ''}.\n\n`
      + 'Its combinations will be removed from the product when you press Save (open orders keep their option name). Remove it?')
  }

  function addValues(ti, text) {
    const list = String(text).split(',').map((x) => x.trim()).filter(Boolean)
    if (!list.length) return
    setTypes((ts) => ts.map((t, i) => {
      if (i !== ti) return t
      const have = new Set(t.values.map((v) => v.en.trim().toLowerCase()))
      const add = []
      for (const en of list) {
        const clean = en.replace(/\//g, '-')
        if (!have.has(clean.toLowerCase())) { have.add(clean.toLowerCase()); add.push({ en: clean, ar: '', image: '' }) }
      }
      return { ...t, values: [...t.values, ...add] }
    }))
    setDraft((d) => ({ ...d, [ti]: '' }))
  }

  function removeValue(ti, vi) {
    const val = types[ti].values[vi].en.trim()
    const gone = combos.filter((c) => c.values[ti] === val).map((c) => c.name)
    if (!askToRemove(`"${val}"`, gone)) return
    setTypes((ts) => ts.map((t, i) => (i === ti ? { ...t, values: t.values.filter((_, j) => j !== vi) } : t)))
  }

  // a value that is not saved yet can be renamed (its numbers follow it); saved values keep their name,
  // because open orders and stock use it (remove it and add a new one instead)
  function renameValue(ti, vi, en) {
    const clean = en.replace(/\//g, '-')
    const old = types[ti].values[vi].en.trim()
    setF((s) => {
      const nextTypes = s.optionTypes.map((t, i) => (i === ti ? { ...t, values: t.values.map((v, j) => (j === vi ? { ...v, en: clean } : v)) } : t))
      const moved = { ...s.combos }
      for (const c of combinationsOf(s.optionTypes)) {
        if (c.values[ti] !== old || !moved[c.name]) continue
        const vals = [...c.values]; vals[ti] = clean.trim()
        moved[vals.join(' / ')] = moved[c.name]
        delete moved[c.name]
      }
      return { ...s, optionTypes: nextTypes, combos: moved }
    })
  }
  const setValue = (ti, vi, patch) => setTypes((ts) => ts.map((t, i) => (i === ti ? { ...t, values: t.values.map((v, j) => (j === vi ? { ...v, ...patch } : v)) } : t)))

  function addType() {
    if (types.length >= 2) return
    if (types.length === 1 && combos.length) {
      const names = combos.map((c) => c.name)
      const { stock, orders } = at(names)
      if ((stock || orders) && !window.confirm(`A second type creates new combinations (e.g. "${combos[0].name} / …").\n\n`
        + `The current options have ${stock} unit(s) in stock${orders ? ` and ${orders} open order(s)` : ''}: `
        + 'enter the stock again for each new combination. Nothing changes until you press Save. Continue?')) return
    }
    setTypes((ts) => [...ts, { name: { en: ts.length ? 'Color' : 'Size', ar: ts.length ? 'اللون' : 'الحجم' }, values: [] }])
  }
  function removeType(ti) {
    if (!askToRemove(`The option type "${types[ti].name.en}"`, combos.map((c) => c.name))) return
    setTypes((ts) => ts.filter((_, i) => i !== ti))
  }

  // summary: switched-on combinations
  const on = combos.filter((c) => rowOf(c.name).enabled !== false)
  const totalStock = combos.reduce((n, c) => n + (Number(rowOf(c.name).stock) || 0), 0)
  const onStock = on.reduce((n, c) => n + (Number(rowOf(c.name).stock) || 0), 0)
  const prices = on.map((c) => (Number(rowOf(c.name).price) > 0 ? Number(rowOf(c.name).price) : Number(basePrice) || 0))
  const allValues = types.flatMap((t, ti) => t.values.filter((v) => v.en.trim()).map((v) => ({ ti, en: v.en.trim(), label: `${t.name.en || 'Type'}: ${v.en.trim()}` })))

  return (
    <section className="rounded-xl border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Options <span className="text-xs font-normal text-gray-500">(up to 2 types, e.g. Size and Color)</span></h3>
        <div className="flex gap-2">
          {types.length === 0 && f.variants.some((v) => v.name.trim()) && (
            <button type="button" onClick={() => setF((s) => ({ ...s, ...fromOldVariants(s.variants) }))}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-100">Use the variants below as an option type</button>
          )}
          {types.length < 2 && (
            <button type="button" onClick={addType} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100">
              <Plus size={16} /> Add option type
            </button>
          )}
        </div>
      </div>
      {types.length === 0 && <p className="text-xs text-gray-500">No option types: the product uses the plain variant list below (or none).</p>}

      <div className="space-y-3">
        {types.map((t, ti) => (
          <div key={ti} className="rounded-lg bg-gray-50 p-3">
            <div className="mb-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input aria-label="Type name (English)" placeholder="Type (English), e.g. Size" className={inputCls} value={t.name.en}
                onChange={(e) => setTypes((ts) => ts.map((x, i) => (i === ti ? { ...x, name: { ...x.name, en: e.target.value } } : x)))} />
              <input aria-label="Type name (Arabic)" dir="rtl" placeholder="الاسم بالعربية" className={inputCls} value={t.name.ar}
                onChange={(e) => setTypes((ts) => ts.map((x, i) => (i === ti ? { ...x, name: { ...x.name, ar: e.target.value } } : x)))} />
              <button type="button" onClick={() => removeType(ti)} aria-label="Remove this option type" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
            </div>

            <div className="space-y-1.5">
              {t.values.map((v, vi) => (
                <div key={vi} className="rounded-md bg-white p-1.5">
                  <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                    <input aria-label="Value (English)" className={`${inputCls} ${v.saved ? 'bg-gray-100' : ''}`} value={v.en} readOnly={v.saved}
                      title={v.saved ? 'Saved values keep their name (orders and stock use it). Remove it and add a new one to rename.' : undefined}
                      onChange={(e) => renameValue(ti, vi, e.target.value)} />
                    <input aria-label="Value (Arabic)" dir="rtl" placeholder="بالعربية" className={inputCls} value={v.ar} onChange={(e) => setValue(ti, vi, { ar: e.target.value })} />
                    <button type="button" onClick={() => removeValue(ti, vi)} aria-label={`Remove ${v.en}`} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"><X size={16} /></button>
                  </div>
                  {images.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-gray-500">Picture:</span>
                      {images.map((img) => (
                        <button type="button" key={img.url} onClick={() => setValue(ti, vi, { image: v.image === img.url ? '' : img.url })}
                          aria-pressed={v.image === img.url}
                          className={`h-8 w-8 overflow-hidden rounded border-2 ${v.image === img.url ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                          <img src={optimizeImg(img.url, 60)} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <input className={`${inputCls} mt-2`} value={draft[ti] || ''}
              placeholder="Type a value and press Enter (or paste a list: 100 ml, 200 ml)"
              onChange={(e) => setDraft((d) => ({ ...d, [ti]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addValues(ti, e.currentTarget.value) } }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (text.includes(',') || text.includes('\n')) { e.preventDefault(); addValues(ti, text.replace(/\n/g, ',')) }
              }} />
          </div>
        ))}
      </div>

      {combos.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-end gap-3 text-sm">
            <label className="flex items-center gap-1">Stock for all
              <input type="number" min="0" className={`${cellCls} w-20`} value={bulk.stock} onChange={(e) => setBulk((b) => ({ ...b, stock: e.target.value }))} />
              <button type="button" disabled={bulk.stock === ''} onClick={() => setAll(combos.map((c) => c.name), { stock: Number(bulk.stock) || 0 })}
                className="rounded-md border px-2 py-1 hover:bg-gray-100 disabled:opacity-40">Set</button>
            </label>
            <label className="flex items-center gap-1">Price for all
              <input type="number" min="0" step="0.01" className={`${cellCls} w-20`} value={bulk.price} onChange={(e) => setBulk((b) => ({ ...b, price: e.target.value }))} />
              <button type="button" disabled={bulk.price === ''} onClick={() => setAll(combos.map((c) => c.name), { price: bulk.price })}
                className="rounded-md border px-2 py-1 hover:bg-gray-100 disabled:opacity-40">Set</button>
            </label>
            {types.length > 1 && (
              <label className="flex flex-wrap items-center gap-1">Price for every
                <select className="rounded-md border px-2 py-1 text-sm" value={bulk.value} onChange={(e) => setBulk((b) => ({ ...b, value: e.target.value }))}>
                  <option value="">choose a value</option>
                  {allValues.map((v) => <option key={`${v.ti}:${v.en}`} value={`${v.ti}:${v.en}`}>{v.label}</option>)}
                </select>
                <input type="number" min="0" step="0.01" className={`${cellCls} w-20`} value={bulk.valuePrice} onChange={(e) => setBulk((b) => ({ ...b, valuePrice: e.target.value }))} />
                <button type="button" disabled={!bulk.value || bulk.valuePrice === ''}
                  onClick={() => {
                    const [ti, ...rest] = bulk.value.split(':'); const val = rest.join(':')
                    setAll(combos.filter((c) => c.values[Number(ti)] === val).map((c) => c.name), { price: bulk.valuePrice })
                  }}
                  className="rounded-md border px-2 py-1 hover:bg-gray-100 disabled:opacity-40">Set</button>
              </label>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="p-2 text-start">Combination</th>
                  <th className="p-2">On</th>
                  <th className="p-2 text-start">Stock</th>
                  <th className="p-2 text-start">Price</th>
                  <th className="p-2 text-start">Was</th>
                  <th className="p-2 text-start">Cost / unit</th>
                </tr>
              </thead>
              <tbody>
                {combos.map((c) => {
                  const row = rowOf(c.name)
                  return (
                    <tr key={c.name} className={`border-t ${row.enabled === false ? 'bg-gray-50 text-gray-400' : ''}`}>
                      <td className="whitespace-nowrap p-2 font-medium">
                        {c.name}
                        {!f.combos[c.name] && <span className="ms-1 rounded bg-blue-50 px-1 text-[10px] font-semibold text-accent">new</span>}
                        {usage[c.name] > 0 && <span className="ms-1 text-[11px] text-gray-500">({usage[c.name]} open)</span>}
                      </td>
                      <td className="p-2 text-center">
                        <input type="checkbox" aria-label={`${c.name} on sale`} checked={row.enabled !== false} onChange={(e) => setCombo(c.name, { enabled: e.target.checked })} />
                      </td>
                      <td className="p-1"><input type="number" min="0" aria-label={`${c.name} stock`} className={cellCls} value={row.stock} onChange={(e) => setCombo(c.name, { stock: e.target.value })} /></td>
                      <td className="p-1"><input type="number" min="0" step="0.01" aria-label={`${c.name} price`} placeholder={String(basePrice || '')} className={cellCls} value={row.price} onChange={(e) => setCombo(c.name, { price: e.target.value })} /></td>
                      <td className="p-1"><input type="number" min="0" step="0.01" aria-label={`${c.name} old price`} className={cellCls} value={row.compareAtPrice} onChange={(e) => setCombo(c.name, { compareAtPrice: e.target.value })} /></td>
                      <td className="p-1"><input type="number" min="0" step="0.01" aria-label={`${c.name} cost`} placeholder="product" className={cellCls} value={row.cost} onChange={(e) => setCombo(c.name, { cost: e.target.value })} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Total stock <b>{totalStock}</b>{onStock !== totalStock && <> (<b>{onStock}</b> on sale)</>}
            {prices.length > 0 && <> · Price <b>QAR {r2(Math.min(...prices))}</b>{Math.min(...prices) !== Math.max(...prices) && <> – <b>QAR {r2(Math.max(...prices))}</b></>}</>}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Empty price = the product price (and the pack offers). A combination with its own price is sold at that price for every
            quantity (pack prices are for the product price). Empty cost = the product cost.
          </p>
        </div>
      )}
    </section>
  )
}
