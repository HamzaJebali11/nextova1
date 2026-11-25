import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'

// Shared admin list style (same look as Orders and Products):
// page header, filter chips with counts, search, coloured tags, a table with a sticky header,
// a side panel for details and a pager. Black / white / grey; red only for errors and alerts.

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:mb-2">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="max-w-3xl text-sm text-gray-500 print:hidden">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  )
}

export function Toolbar({ children }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">{children}</div>
}

// count: number shown in the chip; alert: show the count as a red notification badge
export function FilterChip({ active, onClick, count, alert, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
        active ? 'bg-ink text-white' : 'border bg-white text-ink hover:bg-gray-100'
      }`}>
      {children}
      {count > 0 && (
        <span className={`rounded-full px-1.5 text-[11px] font-bold ${alert ? 'bg-red-500 text-white' : active ? 'bg-white/20' : 'bg-gray-100'}`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search…', className = 'w-full md:w-64' }) {
  return (
    <label className={`relative ${className}`}>
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="min-h-10 w-full rounded-lg border bg-white py-2 pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-gray-900" />
    </label>
  )
}

const TONES = {
  ink: 'bg-ink text-white',
  dark: 'bg-gray-700 text-white',
  soft: 'bg-gray-200 text-ink',
  outline: 'bg-white text-ink ring-1 ring-inset ring-ink',
  muted: 'bg-gray-100 text-gray-600',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  alert: 'bg-red-600 text-white',
}
export function Tag({ tone = 'soft', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}>{children}</span>
}

// a table in a scrolling box whose header stays visible
export function ListTable({ head, children, loading, empty, colSpan, minWidth = '48rem', maxHeight = 'max-h-[70vh]' }) {
  return (
    <div className={`${maxHeight} overflow-auto rounded-2xl border bg-white shadow-sm print:max-h-none print:overflow-visible print:shadow-none`}>
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-gray-200)]">
          <tr className="text-xs text-gray-500">{head}</tr>
        </thead>
        <tbody className="divide-y">
          {loading && [0, 1, 2, 3].map((i) => (
            <tr key={`s${i}`} className="animate-pulse"><td colSpan={colSpan} className="p-3"><div className="h-9 rounded bg-gray-100" /></td></tr>
          ))}
          {!loading && empty && (
            <tr><td colSpan={colSpan} className="p-8 text-center text-gray-500">{empty}</td></tr>
          )}
          {!loading && children}
        </tbody>
      </table>
    </div>
  )
}

export const Th = ({ children, end, className = '' }) => (
  <th className={`p-3 font-medium ${end ? 'text-end' : 'text-start'} ${className}`}>{children}</th>
)

// details panel sliding in from the side (Esc or the backdrop closes it)
export function SidePanel({ title, onClose, children, width = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/40 print:hidden" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.aside onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className={`h-full w-full ${width} overflow-y-auto bg-white p-6 shadow-xl`}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button>
        </div>
        {children}
      </motion.aside>
    </motion.div>
  )
}

export function Pager({ page, pages, total, label = 'item(s)', onPage }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600 print:hidden">
      <span>{total} {label}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
        <span>{page} / {pages || 1}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
      </div>
    </div>
  )
}
