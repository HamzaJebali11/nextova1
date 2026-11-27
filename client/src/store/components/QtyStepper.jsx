import { Minus, Plus } from 'lucide-react'

export default function QtyStepper({ value, onChange, min = 1, max = 20 }) {
  return (
    <div className="glass-btn gap-0">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="grid h-11 w-11 place-items-center rounded-full hover:bg-quiet disabled:opacity-40">
        <Minus size={16} />
      </button>
      <span className="w-8 text-center text-sm font-semibold">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="grid h-11 w-11 place-items-center rounded-full hover:bg-quiet disabled:opacity-40">
        <Plus size={16} />
      </button>
    </div>
  )
}