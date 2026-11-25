import { useState } from 'react'
import { Star } from 'lucide-react'

// Orange rating stars (the only orange on the storefront besides the home and category banners).
// Filled #FF8A1F with a thin #D9600B outline (the outline reaches 3.7:1 on white; the orange alone is 2.4:1),
// empty #E7E5E4. Half stars when the average needs one. The stars follow the page direction:
// in Arabic they fill from the right.
const FILLED = { fill: '#FF8A1F', color: '#D9600B' }
const EMPTY = { fill: '#E7E5E4', color: '#D6D3D1' }

export function Stars({ value = 0, size = 16 }) {
  const v = Math.round(Math.max(0, Math.min(5, Number(value) || 0)) * 2) / 2 // nearest half star
  return (
    <span className="inline-flex" role="img" aria-label={`${v} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden="true">
            <Star size={size} strokeWidth={1.5} className="absolute inset-0" style={EMPTY} />
            {fill > 0 && (
              <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} strokeWidth={1.5} className="absolute top-0 start-0" style={{ ...FILLED, minWidth: size }} />
              </span>
            )}
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
    <div className="inline-flex gap-1" role="radiogroup" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} aria-label={`${i}`} role="radio" aria-checked={value === i}
          onClick={() => onChange(i)} onMouseEnter={() => setHover(i)}
          className="rounded transition duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9600B]">
          <Star size={size} strokeWidth={1.5} style={i <= shown ? FILLED : EMPTY} />
        </button>
      ))}
    </div>
  )
}
