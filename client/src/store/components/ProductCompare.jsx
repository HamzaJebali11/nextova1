import { Check, X } from 'lucide-react'
import { useStore } from '../storeContext'
import Section from './Section'

function Cell({ value }) {
  const v = (value || '').trim()
  if (['✓', '✔', 'yes', 'Yes'].includes(v)) return <Check size={22} className="mx-auto text-ink" />
  if (['✗', '✘', 'x', 'X', 'no', 'No'].includes(v)) return <X size={22} className="mx-auto text-red-500" />
  return <span>{v}</span>
}

export default function ProductCompare({ rows }) {
  const { t, pick } = useStore()
  if (!rows || rows.length === 0) return null

  return (
    <Section title={t('compareTitle')}>
      <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-quiet text-center text-sm font-bold">
          <div className="p-4" />
          <div className="bg-emerald-600 p-4 text-white">{t('compareUs')}</div>
          <div className="p-4 text-gray-600">{t('compareThem')}</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr] items-center border-t text-center text-sm">
            <div className="p-4 text-start font-medium">{pick(r.feature)}</div>
            <div className="bg-emerald-50/60 p-4 font-semibold text-emerald-800"><Cell value={pick(r.ours)} /></div>
            <div className="p-4 text-gray-500"><Cell value={pick(r.theirs)} /></div>
          </div>
        ))}
      </div>
      </div>
    </Section>
  )
}