import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'

// picks: one variant name per unit. With 3 units, the customer chooses an option for each one.
export default function VariantPicker({ variants, picks, onPick, onSame, onSoldOut }) {
  const { t } = useStore()
  const counts = {}
  picks.forEach((n) => { counts[n] = (counts[n] || 0) + 1 })
  const many = picks.length > 1

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{many ? t('chooseEach') : t('option')}</span>
        {many && (
          <button type="button" onClick={() => onSame(picks[0])}
            className="text-xs font-medium text-emerald-600 hover:underline">
            {t('sameForAll')}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {picks.map((current, i) => (
          <div key={i}>
            {many && <div className="mb-1 text-xs text-gray-500">{t('itemN').replace('{n}', i + 1)}</div>}
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const soldOut = v.stock <= 0
                const taken = (counts[v.name] || 0) - (current === v.name ? 1 : 0)
                const full = !soldOut && taken >= v.stock // choosing it again would pass the stock
                const selected = current === v.name
                return (
                  <button key={v.name} type="button"
                    onClick={() => (soldOut ? onSoldOut(v.name) : full ? null : onPick(i, v.name))}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                      selected ? 'border-gray-900 bg-gray-900 text-white' : 'hover:border-gray-900'
                    } ${soldOut || full ? 'opacity-50' : ''} ${soldOut ? 'line-through' : ''}`}>
                    {v.image && <img src={optimizeImg(v.image, 60)} alt="" className="h-6 w-6 rounded-full object-cover" />}
                    {v.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}