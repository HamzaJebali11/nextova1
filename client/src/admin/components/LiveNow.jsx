import { Link } from 'react-router-dom'
import { useLive } from '../useLive'

// Live visitors (Step 42): the sidebar dot + number, the dashboard chip and the Visitors page card.
// "Live" = anonymous visitors whose heartbeat arrived in the last 5 minutes. No personal data.

// green pulsing dot when someone is on the site, grey when nobody is
export function LiveDot({ className = '' }) {
  const live = useLive()
  const n = live?.total || 0
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={`${n} live now`} aria-label={`${n} visitors live now`}>
      <span className="relative flex h-2.5 w-2.5">
        {n > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${n > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
      </span>
      {n > 0 && <span className="text-xs font-semibold tabular-nums">{n}</span>}
    </span>
  )
}

// small chip for the dashboard header
export function LiveChip() {
  const live = useLive()
  return (
    <Link to="/admin/visitors" className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
      <LiveDot /> Live: <span className="font-bold tabular-nums">{live?.total ?? '–'}</span>
    </Link>
  )
}

const BLUE = '#2563EB' // the admin chart colour
const PAGES = [
  ['Browsing', (p) => p.home + p.shop + p.category + p.other],
  ['On product pages', (p) => p.product],
  ['In cart', (p) => p.cart],
  ['At checkout', (p) => p.checkout + p.confirmation],
]

function Bars({ rows, total }) {
  return (
    <ul className="space-y-2">
      {rows.map(([label, n]) => (
        <li key={label} className="text-sm">
          <div className="flex justify-between"><span className="text-gray-600">{label}</span><span className="font-semibold tabular-nums">{n}</span></div>
          <div className="mt-1 h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%`, background: BLUE }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// "Live now" card at the top of the Visitors page
export function LiveNowCard() {
  const live = useLive()
  const total = live?.total || 0
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm" aria-label="Live now">
      <div className="grid gap-6 md:grid-cols-[12rem_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600"><LiveDot /> Live now</div>
          <div className="mt-2 text-5xl font-extrabold tabular-nums">{live ? total : '–'}</div>
          <div className="mt-1 text-xs text-gray-500">visitors in the last {Math.round((live?.windowSeconds || 300) / 60) || 1} min · updates every 15 s</div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">By page</h3>
          <Bars total={total} rows={PAGES.map(([label, f]) => [label, live ? f(live.byPage) : 0])} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">By device</h3>
          <Bars total={total} rows={[['Phone', live?.byDevice.phone || 0], ['Tablet', live?.byDevice.tablet || 0], ['Desktop', live?.byDevice.desktop || 0]]} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Now viewing</h3>
          {live?.top?.length ? (
            <ol className="space-y-1.5 text-sm">
              {live.top.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{p.slug ? <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="hover:underline">{p.name?.en}</a> : p.name?.en}</span>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white tabular-nums" style={{ background: BLUE }}>{p.count}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-gray-500">No product page open right now.</p>}
        </div>
      </div>
    </section>
  )
}
