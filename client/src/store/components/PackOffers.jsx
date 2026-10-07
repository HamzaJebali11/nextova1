import { packLabel } from '../../lib/pricing'
import { useStore } from '../storeContext'

// base = price of one unit; packs = [{ qty, price (total), badge }]
export default function PackOffers({ base, packs, qty, max, onPick }) {
  const { t, lang, pick, money } = useStore()
  if (!packs || packs.length === 0) return null

  const options = [{ qty: 1, price: base }, ...[...packs].sort((a, b) => a.qty - b.qty)]

  return (
    <div className="mt-5">
      <div className="mb-2 text-sm font-medium">{t('packTitle')}</div>
      <div className="grid gap-2.5">
        {options.map((o) => {
          const save = Math.round((base * o.qty - o.price) * 100) / 100
          const active = qty === o.qty
          const disabled = o.qty > max
          const badge = pick(o.badge)
          return (
            <button key={o.qty} type="button" disabled={disabled} onClick={() => onPick(o.qty)}
              className={`relative flex items-center justify-between gap-3 rounded-2xl border-2 p-4 text-start transition disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? 'border-emerald-600 bg-emerald-50' : 'hover:border-gray-400'
              }`}>
              <span className="flex items-center gap-3">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${active ? 'border-emerald-600' : 'border-gray-300'}`}>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />}
                </span>
                <span>
                  <span className="block font-semibold">{packLabel(o.qty, lang)}</span>
                  {o.qty > 1 && (
                    <span className="block text-xs text-gray-500">{money(o.price / o.qty)} {t('perUnit')}</span>
                  )}
                </span>
              </span>
              <span className="text-end">
                <span className="block font-bold">{money(o.price)}</span>
                {save > 0 && (
                  <span className="block text-xs font-semibold text-green-600">{t('youSave').replace('{amt}', money(save))}</span>
                )}
              </span>
              {badge && (
                <span className="absolute -top-2.5 end-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}