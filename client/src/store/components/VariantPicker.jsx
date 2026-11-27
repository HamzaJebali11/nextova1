import { useEffect, useRef, useState } from 'react'
import { optimizeImg } from '../../lib/image'
import { comboOf, isOn, typeLabel, valueLabel } from '../../lib/options'
import { useStore } from '../storeContext'

// Compact option chips (product page).
// - 5 or fewer options: all of them. More: the first 4, then "+N more" (smooth height change), then "Show less".
// - The chosen option is always visible: when it is not among the first 4 it takes the 4th place.
// - 44px tap targets, 0 14px padding, 8px gap. White with a #E7E5E4 border and #111111 text; chosen = blue
//   with white text; sold out = #F5F5F4, grey, crossed out, never chosen (tapping it opens "notify me").
// Display only: what a choice does (stock, price, picture) is decided by the product page and the server.

const SHOW = 4 // chips shown before "+N more"
const ALL_UP_TO = 5 // this many or fewer: no "+N more"

// glass chips (glass.css .glass-chip): chosen = blue gradient, sold out / off = grey crossed out, full = faded
const chipCls = (state, selected) => {
  if (selected) return 'glass-chip is-chosen'
  if (state === 'soldout' || state === 'off') return 'glass-chip is-soldout'
  if (state === 'full') return 'glass-chip is-full'
  return 'glass-chip'
}
const moreCls = 'glass-chip is-more'

// the height follows the content smoothly (chips expanding, a message appearing): nothing below jumps
function SmoothHeight({ children }) {
  const inner = useRef(null)
  const [h, setH] = useState(null)
  useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div style={{ height: h ?? 'auto' }} className="-m-1 overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none">
      <div ref={inner} className="p-1">{children}</div>
    </div>
  )
}

// items: [{ key, label, image, state: 'ok' | 'soldout' | 'full' | 'off' }]
export function Chips({ items, selected, onChoose, label }) {
  const { t } = useStore()
  const [open, setOpen] = useState(false)
  const many = items.length > ALL_UP_TO
  let shown = items
  if (many && !open) {
    shown = items.slice(0, SHOW)
    const sel = items.findIndex((x) => x.key === selected)
    if (sel >= SHOW) shown = [...items.slice(0, SHOW - 1), items[sel]] // the chosen one takes the 4th place
  }
  const hidden = items.length - shown.length

  return (
    <SmoothHeight>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {shown.map((x) => {
          const on = x.key === selected
          const blocked = x.state !== 'ok'
          return (
            <button key={x.key} type="button" onClick={() => onChoose(x)} aria-pressed={on}
              aria-disabled={blocked && !on ? 'true' : undefined} className={chipCls(x.state, on)}>
              {x.image && <img src={optimizeImg(x.image, 60)} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />}
              {x.label}
              {x.state === 'soldout' && !on && <span className="sr-only"> ({t('soldOut')})</span>}
            </button>
          )
        })}
        {many && !open && (
          <button type="button" onClick={() => setOpen(true)} aria-expanded="false" className={moreCls}>
            {t('variantsMore').replace('{n}', hidden)}
          </button>
        )}
        {many && open && (
          <button type="button" onClick={() => setOpen(false)} aria-expanded="true" className={moreCls}>
            {t('variantsLess')}
          </button>
        )}
      </div>
    </SmoothHeight>
  )
}

function Header({ many, onSame, first }) {
  const { t } = useStore()
  return (
    <div className="mb-2 flex items-center justify-between text-sm">
      <span className="font-medium">{many ? t('chooseEach') : t('option')}</span>
      {many && (
        <button type="button" onClick={() => onSame(first)}
          className="min-h-11 text-xs font-medium text-ink underline-offset-2 hover:underline md:min-h-0">
          {t('sameForAll')}
        </button>
      )}
    </div>
  )
}

// stock still free for unit i (the other units already take some)
const takenBy = (names, i) => {
  const out = {}
  names.forEach((n, j) => { if (j !== i && n) out[n] = (out[n] || 0) + 1 })
  return out
}

// OLDER PRODUCTS (one plain list of variants). picks: one variant name per unit.
export default function VariantPicker({ variants, picks, onPick, onSame, onSoldOut }) {
  const { t } = useStore()
  const many = picks.length > 1
  return (
    <div>
      <Header many={many} onSame={onSame} first={picks[0]} />
      <div className="space-y-3">
        {picks.map((current, i) => {
          const taken = takenBy(picks, i)
          const items = variants.map((v) => {
            const soldOut = v.stock <= 0
            return {
              key: v.name, label: v.name, image: v.image,
              state: soldOut ? 'soldout' : (taken[v.name] || 0) >= v.stock ? 'full' : 'ok',
            }
          })
          return (
            <div key={i}>
              {many && <div className="mb-1 text-xs text-gray-500">{t('itemN').replace('{n}', i + 1)}</div>}
              <Chips items={items} selected={current} label={t('option')}
                onChoose={(x) => { if (x.state === 'soldout') onSoldOut(x.key); else if (x.state === 'ok') onPick(i, x.key) }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// PRODUCTS WITH OPTION TYPES: one chip group per type ("Size", "Color"), for every unit.
// parts[i] = the chosen English value of each type for unit i (null = not chosen yet).
// After one value is chosen, values of the other group that are sold out (or switched off) for that pair are greyed.
// missing = Set of "unit:type" keys to highlight (Order now / Add to cart pressed with a group not chosen).
export function OptionPicker({ product, types, parts, onPart, onSame, onSoldOut, missing, groupRef }) {
  const { t, lang } = useStore()
  const many = parts.length > 1
  const variants = product.variants || []
  const names = parts.map((vals) => comboOf(product, vals)?.name || null)

  // state of value `val` of type `ti` for unit `i`, given the other values chosen for that unit
  function stateOf(i, ti, val) {
    const taken = takenBy(names, i)
    const free = (v) => (Number(v.stock) || 0) - (taken[v.name] || 0)
    const others = parts[i].map((x, k) => (k === ti ? val : x))
    if (others.every(Boolean)) {
      const v = comboOf(product, others)
      if (!v || !isOn(v)) return { state: 'off' }
      if ((Number(v.stock) || 0) <= 0) return { state: 'soldout', combo: v.name }
      return { state: free(v) > 0 ? 'ok' : 'full' }
    }
    // the other group is not chosen yet: available if any switched-on pair with this value has stock
    const list = variants.filter((v) => isOn(v) && v.options?.[ti]?.value === val)
    if (!list.length) return { state: 'off' }
    if (list.some((v) => free(v) > 0)) return { state: 'ok' }
    return { state: list.some((v) => (Number(v.stock) || 0) > 0) ? 'full' : 'soldout' }
  }

  return (
    <div>
      {many && <Header many onSame={onSame} first={parts[0]} />}
      <div className="space-y-4">
        {parts.map((vals, i) => (
          <div key={i} className="space-y-3">
            {many && <div className="text-xs text-gray-500">{t('itemN').replace('{n}', i + 1)}</div>}
            {types.map((type, ti) => {
              const name = typeLabel(type, lang)
              const chosen = vals[ti]
              const isMissing = missing?.has(`${i}:${ti}`)
              const items = type.values.map((val) => ({
                key: val.en, label: valueLabel(type, val.en, lang), image: val.image, ...stateOf(i, ti, val.en),
              }))
              return (
                <div key={type.name.en} ref={(el) => groupRef?.(i, ti, el)}
                  className={`scroll-mt-28 rounded-2xl transition duration-150 ${isMissing ? 'bg-red-50 p-2 ring-2 ring-red-400' : ''}`}>
                  <div className="mb-2 text-sm">
                    <span className="font-medium">{name}</span>
                    {chosen && <span className="text-gray-600">: {valueLabel(type, chosen, lang)}</span>}
                  </div>
                  <Chips items={items} selected={chosen} label={name}
                    onChoose={(x) => {
                      if (x.key === chosen && types.length > 1) onPart(i, ti, null) // tap again: clear (2 types)
                      else if (x.state === 'ok') onPart(i, ti, x.key)
                      else if (x.state === 'soldout' && x.combo) onSoldOut(x.combo)
                    }} />
                  {isMissing && (
                    <p role="alert" className="mt-2 text-sm font-medium text-red-700">{t('chooseType').replace('{type}', name)}</p>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
