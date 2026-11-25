import { Check } from 'lucide-react'
import { packLabel } from '../../lib/pricing'
import { useStore } from '../storeContext'

const r2 = (n) => Math.round(n * 100) / 100

// Pack cards: the ONLY place prices show for a product with packs.
// Each card: pack total, the old total crossed out, and the price per unit (blue highlight).
// The saving itself is shown once, as a tag on the main picture (not here).
// Display only: totals are the pack prices you set; nothing here changes a price.
// base = price of one unit; compareAt = old price of one unit; packs = [{ qty, price (total), badge }]
export default function PackOffers({ base, compareAt, packs, qty, max, onPick }) {
  const { t, lang, pick, money } = useStore()
  if (!packs || packs.length === 0) return null

  const options = [{ qty: 1, price: base }, ...[...packs].sort((a, b) => a.qty - b.qty)]
  const oldUnit = compareAt > base ? compareAt : base

  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{t('packTitle')}</div>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o) => {
          const active = qty === o.qty
          const disabled = o.qty > max
          const badge = pick(o.badge)
          const oldTotal = r2(oldUnit * o.qty)
          return (
            <button key={o.qty} type="button" disabled={disabled} onClick={() => onPick(o.qty)}
              aria-pressed={active}
              className={`relative rounded-2xl bg-white px-3.5 py-3 text-start text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? 'border-2 border-ink shadow-e1' : 'nx-lift border border-line shadow-e1 hover:border-gray-400'
              }`}>
              {active && (
                <span aria-hidden="true" className="absolute -top-2 start-3 grid h-5 w-5 place-items-center rounded-full bg-ink text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
              {badge && (
                <span className="absolute -top-2.5 end-3 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  {badge}
                </span>
              )}
              <span className="block text-[13px] font-semibold text-gray-700">{packLabel(o.qty, lang)}</span>
              <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-lg font-extrabold leading-tight text-ink">{money(o.price)}</span>
                {oldTotal > o.price && <s className="text-xs text-gray-500">{money(oldTotal)}</s>}
              </span>
              {/* price per unit only on multi-unit packs (the 1-pack price already is the unit price) */}
              {o.qty > 1 && (
                <span className="mt-1 inline-block rounded-md bg-accent px-1.5 py-0.5 text-[12px] font-bold text-white">
                  {t('eachPrice').replace('{amt}', money(r2(o.price / o.qty)))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
