import { useState } from 'react'
import { Star } from 'lucide-react'

export function Stars({ value = 0, size = 16 }) {
  return (
    <span dir="ltr" className="inline-flex" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-gray-300" />
            <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="fill-amber-400 text-amber-400" style={{ minWidth: size }} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

export function StarInput({ value, onChange, size = 28 }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div dir="ltr" className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} aria-label={`${i}`}
          onClick={() => onChange(i)} onMouseEnter={() => setHover(i)}
          className="transition hover:scale-110">
          <Star size={size} className={i <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
        </button>
      ))}
    </div>
  )
}