import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { optimizeImg } from '../../lib/image'

// Compact filter button that opens a small panel (Orders page, Delivery sheet).
// Same height and style for every filter; closes on a click outside or Esc.
const filterBtn = (active) =>
  `inline-flex h-10 max-w-[15rem] items-center gap-1.5 rounded-lg border px-3 text-sm transition ${
    active ? 'border-ink bg-ink text-white' : 'bg-white text-ink hover:bg-gray-100'
  }`

export function FilterMenu({ label, value, active, badge, align = 'start', width = 'w-64', onOpen, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { if (!open) onOpen?.(); setOpen(!open) }} aria-haspopup="dialog" aria-expanded={open}
        className={filterBtn(active)}>
        <span className={active ? 'opacity-70' : 'text-gray-500'}>{label}</span>
        {value && <span className="truncate font-semibold">{value}</span>}
        {badge > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>}
        <ChevronDown size={15} aria-hidden="true" className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="dialog" aria-label={label}
          className={`absolute top-full z-30 mt-2 rounded-xl border bg-white p-2 text-ink shadow-e2 ${width} ${align === 'end' ? 'end-0' : 'start-0'}`}>
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

// one choice in a filter panel
export function MenuOption({ selected, onClick, count, alert, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm transition hover:bg-gray-100 ${selected ? 'font-semibold' : ''}`}>
      <Check size={15} aria-hidden="true" className={selected ? 'shrink-0' : 'shrink-0 opacity-0'} />
      <span className="flex-1 truncate">{children}</span>
      {count > 0 && (
        <span className={`rounded-full px-1.5 text-[11px] font-bold ${alert ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'}`}>{count}</span>
      )}
    </button>
  )
}

// Searchable product list: small picture, name, number of orders in the current view.
// options: [{ id, name, nameAr, image, orders, active }]
export function ProductPicker({ options, loading, value, onPick, countLabel = 'orders', autoFocus = true }) {
  const [term, setTerm] = useState('')
  const [hi, setHi] = useState(0)
  const listRef = useRef(null)

  const list = useMemo(() => {
    const t = term.trim().toLowerCase()
    const found = t ? options.filter((o) => `${o.name} ${o.nameAr || ''}`.toLowerCase().includes(t)) : options
    // products with orders in this view first, then by name
    return [...found].sort((a, b) => (b.orders || 0) - (a.orders || 0) || a.name.localeCompare(b.name))
  }, [options, term])

  const rows = [{ id: '', name: 'All products' }, ...list]
  const cur = Math.min(hi, rows.length - 1)

  function onKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.max(0, Math.min(rows.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))
      setHi(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rows[cur]) onPick(rows[cur].id ? rows[cur] : null)
    }
  }

  return (
    <div>
      <label className="relative block">
        <Search size={15} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input autoFocus={autoFocus} value={term} onChange={(e) => { setTerm(e.target.value); setHi(0) }} onKeyDown={onKey}
          placeholder="Search products" aria-label="Search products"
          className="h-10 w-full rounded-lg border ps-8 pe-8 text-sm outline-none focus:ring-2 focus:ring-gray-900" />
        {term && (
          <button type="button" onClick={() => setTerm('')} aria-label="Clear search"
            className="absolute end-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md hover:bg-gray-100">
            <X size={14} />
          </button>
        )}
      </label>
      <ul ref={listRef} role="listbox" aria-label="Products" className="mt-2 max-h-72 overflow-y-auto overscroll-contain">
        {rows.map((o, i) => (
          <li key={o.id || 'all'} role="option" aria-selected={value === o.id}>
            <button type="button" onClick={() => onPick(o.id ? o : null)} onMouseEnter={() => setHi(i)}
              className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm ${i === cur ? 'bg-gray-100' : ''} ${value === o.id ? 'font-semibold' : ''}`}>
              {o.id ? (
                o.image
                  ? <img src={optimizeImg(o.image, 80)} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 shrink-0 rounded-md bg-gray-100 object-cover" />
                  : <span className="h-8 w-8 shrink-0 rounded-md bg-gray-100" aria-hidden="true" />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border text-gray-500" aria-hidden="true"><X size={14} /></span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.id ? o.name : 'All products (clear)'}</span>
                {o.id && o.active === false && <span className="text-[11px] text-gray-500">hidden in store</span>}
              </span>
              {o.id && (
                <span className={`shrink-0 text-xs tabular-nums ${o.orders ? 'font-semibold text-ink' : 'text-gray-400'}`}
                  title={`${o.orders || 0} ${countLabel} in the current view`}>
                  {loading ? '…' : o.orders || 0}
                </span>
              )}
              {value === o.id && o.id && <Check size={15} className="shrink-0" aria-hidden="true" />}
            </button>
          </li>
        ))}
        {list.length === 0 && !loading && <li className="px-2 py-3 text-sm text-gray-500">No product matches “{term}”.</li>}
        {options.length === 0 && loading && <li className="px-2 py-3 text-sm text-gray-500">Loading products…</li>}
      </ul>
      <p className="mt-1 border-t px-2 pt-1.5 text-[11px] text-gray-500">Number = {countLabel} with this product under the other filters.</p>
    </div>
  )
}

// small removable chip for an active filter
export function ActiveChip({ children, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 py-1 ps-3 pe-1 text-xs font-medium text-ink">
      <span className="truncate">{children}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${typeof children === 'string' ? children : ''}`}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-gray-200">
        <X size={12} />
      </button>
    </span>
  )
}
