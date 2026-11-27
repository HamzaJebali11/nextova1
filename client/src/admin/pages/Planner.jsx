import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, RotateCcw } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/constants'
import { calc, defaultsFor, DEFAULTS, hasOptionPrices, rowsOf } from '../../lib/planner'

const inputCls = 'w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

function Num({ label, k, f, set, hint, suffix, placeholder = '0', hideLabel = false }) {
  return (
    <label className="block">
      <span className={hideLabel ? 'sr-only' : 'mb-1 block text-xs font-medium text-gray-700'}>{label}</span>
      <div className="relative">
        <input type="number" min="0" step="any" inputMode="decimal" className={`${inputCls} ${suffix ? 'pe-12' : ''}`}
          placeholder={placeholder} value={f[k]} onChange={(e) => set(k, e.target.value)} />
        {suffix && <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
    </label>
  )
}

// one number cell of a pack row (price or share)
function RowNum({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <div className="relative">
        <input type="number" min="0" step="any" inputMode="decimal" className={`${inputCls} min-h-11 ${suffix ? 'pe-12' : ''}`}
          placeholder="0" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>}
      </div>
    </label>
  )
}

const packName = (n) => `${n} pack${n > 1 ? 's' : ''}`

function Card({ title, children, note }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {children}
      {note && <p className="flex gap-1.5 text-[11px] text-gray-500"><Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{note}</p>}
    </section>
  )
}

function Big({ label, value, note, tone }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-extrabold ${tone === 'bad' ? 'text-red-700' : ''}`}>{value}</div>
      {note && <div className="text-[11px] text-gray-500">{note}</div>}
    </div>
  )
}

const STATUS = {
  green: { text: 'Healthy', icon: CheckCircle2, cls: 'bg-ink text-white', note: 'Break-even CPA is 15% of the order value or more.' },
  amber: { text: 'Thin margin', icon: AlertTriangle, cls: 'bg-gray-200 text-ink ring-1 ring-ink', note: 'Break-even CPA is under 15% of the order value: little room for ads.' },
  red: { text: 'No profit with ads', icon: AlertTriangle, cls: 'bg-red-600 text-white', note: 'This product cannot make profit with ads at these prices.' },
}

export default function Planner() {
  const [products, setProducts] = useState([])
  const [planned, setPlanned] = useState(new Set())
  const [pid, setPid] = useState('')
  const [f, setF] = useState(DEFAULTS)
  const [savedJson, setSavedJson] = useState(JSON.stringify(DEFAULTS))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api('/products/admin/all?limit=100').then((d) => setProducts(d.items || [])).catch(() => {})
    api('/plans').then((list) => setPlanned(new Set(list.map((p) => String(p.product))))).catch(() => {})
  }, [])

  const product = products.find((p) => p._id === pid)

  // the real delivery rate of the last 30 days (orders placed that ended delivered or failed)
  const [realRate, setRealRate] = useState(null)
  const [loadedPid, setLoadedPid] = useState(null) // the "Use" button waits until this product's plan is loaded
  useEffect(() => {
    api('/reports/delivery-rate?days=30').then(setRealRate).catch(() => {})
  }, [])

  // load the saved plan for this product, or its defaults
  useEffect(() => {
    if (!pid || !product) return
    let cancelled = false
    api(`/plans/${pid}`).then((plan) => {
      if (cancelled) return
      // a plan saved before the real pack rows keeps its 1 / 2 / 3 rows and numbers (in memory; saved only on Save)
      const next = plan?.inputs
        ? { ...defaultsFor(product), ...plan.inputs, packRows: rowsOf({ ...DEFAULTS, ...plan.inputs }) }
        : defaultsFor(product)
      setF(next)
      setSavedJson(JSON.stringify(next))
      setLoadedPid(pid)
      setMsg('')
    }).catch((e) => setMsg(e.message))
    return () => { cancelled = true }
  }, [pid, product])

  const r = useMemo(() => calc(f), [f])
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const rows = rowsOf(f)
  const setRow = (idx, k, v) => setF((s) => ({ ...s, packRows: rowsOf(s).map((row, j) => (j === idx ? { ...row, [k]: v } : row)) }))
  // "Balance to 100%": the last row takes whatever the other rows leave (never below 0)
  const othersTotal = rows.slice(0, -1).reduce((sum, row) => sum + (Math.max(0, Number(row.share) || 0)), 0)
  const balance = () => setRow(rows.length - 1, 'share', Math.max(0, Math.round((100 - othersTotal) * 1000) / 1000))
  const dirty = JSON.stringify(f) !== savedJson

  async function save() {
    setBusy(true)
    setMsg('')
    try {
      await api(`/plans/${pid}`, { method: 'PUT', body: { inputs: f } })
      setSavedJson(JSON.stringify(f))
      setPlanned((s) => new Set([...s, pid]))
      setMsg('Plan saved ✓')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const S = STATUS[r.status]
  const m = r.main

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Planner</h1>
          <p className="text-sm text-gray-500">
            Your own calculations per product. Nothing here changes products, prices, orders or profit reports.
          </p>
        </div>
        <select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Product" className={`${inputCls} w-full md:w-80`}>
          <option value="">Choose a product…</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>{p.name?.en}{planned.has(p._id) ? '  ✓ plan saved' : ''}</option>
          ))}
        </select>
      </div>

      {!pid && <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">Choose a product to start a plan.</div>}

      {pid && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ---------------- inputs ---------------- (min-w-0: the wide price table scrolls inside its box on phones) */}
          <div className="min-w-0 space-y-4">
            <Card title="Stock and product cost" note="Landed cost per unit = (factory × units + packaging × units + China shipping + other) ÷ units. Empty fields count as 0.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Num label="Units ordered in total" k="units" f={f} set={set} />
                <Num label="Factory cost per unit" k="factoryPerUnit" f={f} set={set} suffix="QAR" />
                <Num label="Packaging cost per unit" k="packagingPerUnit" f={f} set={set} suffix="QAR" />
                <Num label="Other costs (total, optional)" k="otherCosts" f={f} set={set} suffix="QAR" />
              </div>
            </Card>

            <Card title="Cartons and shipping China → Qatar" note="If you enter a price per kg, shipping = total kg × price per kg (the total field is then ignored).">
              <div className="grid gap-3 sm:grid-cols-3">
                <Num label="Number of cartons" k="cartons" f={f} set={set} />
                <Num label="Units per carton" k="unitsPerCarton" f={f} set={set} />
                <Num label="kg per carton" k="kgPerCarton" f={f} set={set} suffix="kg" />
                <Num label="Shipping total" k="shippingTotal" f={f} set={set} suffix="QAR" />
                <Num label="or price per kg (optional)" k="shippingPerKg" f={f} set={set} suffix="QAR" />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-gray-100 px-3 py-2 text-sm">
                <span>Total weight <b>{r.totalKg} kg</b></span>
                <span>Units in cartons <b>{r.cartonUnits}</b></span>
                <span>Shipping used <b>{money(r.shipping)}</b></span>
              </div>
              {r.cartonsMismatch && (
                <p className="text-xs font-semibold text-red-700">Cartons hold {r.cartonUnits} units but you ordered {r.U}. Check the numbers.</p>
              )}
            </Card>

            <Card title="Delivery in Qatar" note="Failed delivery = the customer refuses or cancels at the door. Left empty, it equals the delivery cost per order.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Num label="Delivery cost per order" k="deliveryPerOrder" f={f} set={set} suffix="QAR" />
                <Num label="Cost of a failed delivery" k="failedCost" f={f} set={set} suffix="QAR" placeholder={String(r.D)} />
                <Num label="Delivery rate" k="deliveryRate" f={f} set={set} suffix="%" hint="Orders really delivered out of orders placed" />
              </div>
              {realRate && loadedPid === pid && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2.5 text-sm">
                  {realRate.rate === null ? (
                    <span className="text-gray-600">Real delivery rate, last 30 days: not enough delivered or failed orders yet (the default is 80%).</span>
                  ) : (
                    <>
                      <span>Real delivery rate, last 30 days: <b>{realRate.rate}%</b> <span className="text-gray-500">({realRate.delivered} delivered, {realRate.failed} failed; default 80%)</span></span>
                      <button type="button" onClick={() => set('deliveryRate', String(realRate.rate))}
                        disabled={String(f.deliveryRate) === String(realRate.rate)}
                        className="ms-auto rounded-lg border bg-white px-3 py-1 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50">Use {realRate.rate}%</button>
                    </>
                  )}
                </div>
              )}
            </Card>

            <Card title="Pack prices and sales mix" note="Rows = this product's real packs. Prices are prefilled from the product's packs and only change here, never on the product. Average units per order = Σ share × units; AOV = Σ share × pack price.">
              {product && hasOptionPrices(product) && (
                <p className="flex gap-1.5 rounded-lg bg-gray-100 p-2 text-xs text-gray-700">
                  <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  This product has prices per option (for example per size). The Planner uses the product's base price.
                </p>
              )}
              {/* at least 4 rows high, so switching products rarely moves what is below */}
              <div className="relative min-h-[14.5rem] overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="py-1 text-start">Pack</th>
                      <th className="text-start">Selling price</th>
                      <th className="text-start">Unit price</th>
                      <th className="text-start">Share of orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={`${row.size}-${idx}`} data-pack-row={row.size}>
                        <td className="py-1.5 pe-3 font-medium">
                          {packName(row.size)}
                          {row.label && <span className="block text-[11px] font-normal text-gray-500">{row.label}</span>}
                        </td>
                        <td className="pe-3"><RowNum label={`Selling price of ${packName(row.size)}`} value={row.price} onChange={(v) => setRow(idx, 'price', v)} suffix="QAR" /></td>
                        <td className="pe-3 text-gray-700">{money(r.perUnit[idx]?.unitPrice || 0)}</td>
                        <td><RowNum label={`Share of orders that are ${packName(row.size)}`} value={row.share} onChange={(v) => setRow(idx, 'share', v)} suffix="%" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm" data-mix-total>
                <span className={r.mixOk ? 'font-semibold' : 'font-semibold text-red-700'}>Total: {r.mixTotal}%</span>
                {!r.mixOk && (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <AlertTriangle size={14} aria-hidden="true" /> The shares must add up to 100%.
                    </span>
                    <button type="button" onClick={balance} disabled={othersTotal > 100}
                      className="min-h-11 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50"
                      title={othersTotal > 100 ? 'The other rows already add up to more than 100%' : undefined}>
                      Balance to 100%
                    </button>
                  </>
                )}
              </div>
            </Card>

            <Card title="Ads target" note="Target CPA = target % × break-even CPA. Default 70%.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Num label="Target CPA (% of break-even)" k="targetPct" f={f} set={set} suffix="%" />
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={save} disabled={busy || !dirty}
                className="rounded-lg bg-accent px-5 py-2.5 font-bold text-white hover:bg-accent-hover disabled:opacity-50">
                {busy ? 'Saving…' : 'Save plan'}
              </button>
              <button type="button" onClick={() => product && setF(defaultsFor(product))}
                className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-100">
                <RotateCcw size={16} aria-hidden="true" /> Reset to defaults
              </button>
              <span className={`text-sm ${dirty ? 'font-semibold text-ink' : 'text-gray-500'}`}>{msg || (dirty ? 'Unsaved changes' : 'Saved')}</span>
            </div>
          </div>

          {/* ---------------- results ---------------- */}
          {!r.mixOk && (
            <aside className="lg:sticky lg:top-4" data-results-blocked>
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm" role="alert">
                <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={18} aria-hidden="true" /> Results paused</div>
                The shares of orders add up to {r.mixTotal}%. They must total 100% before the numbers mean anything.
                Fix the shares or press "Balance to 100%".
              </section>
            </aside>
          )}
          {r.mixOk && (
          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${S.cls}`} role="status">
                <S.icon size={18} aria-hidden="true" /> {S.text}
              </div>
              {r.status === 'red' && (
                <p className="-mt-2 mb-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">This product cannot make profit with ads at these prices.</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Big label="Landed cost / unit" value={money(r.landed)} />
                <Big label="Average order value" value={money(r.aov)} note={`${r.avgUnits} units per order`} />
                <Big label="Profit / placed order before ads" value={money(m.breakEven)} tone={m.breakEven <= 0 ? 'bad' : ''} note={`at ${f.deliveryRate || 0}% delivered`} />
                <Big label="Break-even CPA" value={money(Math.max(0, m.breakEven))} note="max ad cost per placed order" />
                <Big label={`Target CPA (${r.targetPct}%)`} value={money(m.target)} />
                <Big label="Profit / order at target" value={money(m.profitAtTarget)} tone={m.profitAtTarget <= 0 ? 'bad' : ''} />
              </div>
              <div className="mt-4 rounded-xl bg-gray-100 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Total expected profit (selling all stock at target CPA)</div>
                <div className={`text-3xl font-extrabold ${m.totalProfit < 0 ? 'text-red-700' : ''}`}>{money(m.totalProfit)}</div>
                <div className="text-[11px] text-gray-500">{m.orders} placed orders × {money(m.profitAtTarget)}</div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                Profit per placed order before ads = d × (AOV − avg units × landed cost − delivery) − (1 − d) × failed delivery cost,
                d = delivery rate. Returned units go back to stock. Costs round up, profits round down.
              </p>
            </section>

            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Orders needed to sell {r.U} units</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="py-1 text-start">Delivery rate</th>
                    {r.rates.map((x) => <th key={x.pct} className="text-end">{x.pct}%</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="py-1.5">Delivered units / order</td>{r.rates.map((x) => <td key={x.pct} className="text-end">{x.deliveredUnits}</td>)}</tr>
                  <tr><td className="py-1.5 font-semibold">Orders needed</td>{r.rates.map((x) => <td key={x.pct} className="text-end font-bold">{x.orders}<div className="text-[10px] font-normal text-gray-500">{x.ordersRaw}</div></td>)}</tr>
                  <tr><td className="py-1.5">Break-even CPA</td>{r.rates.map((x) => <td key={x.pct} className={`text-end ${x.breakEven <= 0 ? 'text-red-700' : ''}`}>{money(x.breakEven)}</td>)}</tr>
                  <tr><td className="py-1.5">Ad budget at target CPA</td>{r.rates.map((x) => <td key={x.pct} className="text-end">{money(x.budgetTarget)}</td>)}</tr>
                  <tr><td className="py-1.5">Ad budget at break-even</td>{r.rates.map((x) => <td key={x.pct} className="text-end">{money(x.budgetBreakEven)}</td>)}</tr>
                  <tr><td className="py-1.5">Total profit at target</td>{r.rates.map((x) => <td key={x.pct} className={`text-end font-semibold ${x.totalProfit < 0 ? 'text-red-700' : ''}`}>{money(x.totalProfit)}</td>)}</tr>
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-gray-500">
                Orders needed = units ÷ (d × avg units per order), rounded up (small number = exact value).
                Budget = orders × CPA. Example: 20 units, mix 75/20/5, d = 80% → 1.3 units per order → 20 ÷ 1.04 = 19.2 → 20 orders.
              </p>
            </section>

            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Simple per-unit check</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500"><th className="py-1 text-start">Pack</th><th className="text-end">Unit price</th><th className="text-end">Max ad spend / unit</th></tr></thead>
                <tbody className="divide-y">
                  {r.perUnit.map((u, idx) => (
                    <tr key={`${u.pack}-${idx}`} data-unit-row={u.pack}>
                      <td className="py-1.5">{packName(u.pack)}</td>
                      <td className="text-end">{money(u.unitPrice)}</td>
                      <td className={`text-end font-semibold ${u.maxAdPerUnit <= 0 ? 'text-red-700' : ''}`}>{money(u.maxAdPerUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-gray-500">Max ad spend per unit = unit price − landed cost per unit (before delivery and failed orders).</p>
            </section>
          </aside>
          )}
        </div>
      )}
    </div>
  )
}
