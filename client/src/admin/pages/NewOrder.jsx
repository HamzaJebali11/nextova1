import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money, STATUSES } from '../../lib/constants'
import { AREAS } from '../../store/areas'

const SOURCES = [['whatsapp', 'WhatsApp'], ['messenger', 'Messenger'], ['instagram', 'Instagram'], ['phone', 'Phone call'], ['other', 'Other']]
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'
const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
const blankItem = () => ({ productId: '', variantName: '', qty: 1, price: '', cost: '' })
const blankCustomer = { name: '', phone: '', area: '', zone: '', street: '', building: '', address: '', notes: '' }

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

export default function NewOrder() {
  const [products, setProducts] = useState([])
  const [past, setPast] = useState(false)
  const [date, setDate] = useState(today())
  const [source, setSource] = useState('whatsapp')
  const [status, setStatus] = useState('new')
  const [takeStock, setTakeStock] = useState(true)
  const [customer, setCustomer] = useState(blankCustomer)
  const [items, setItems] = useState([blankItem()])
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [shippingCost, setShippingCost] = useState('0')
  const [adminNotes, setAdminNotes] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/products/admin/all?limit=100').then((d) => setProducts(d.items)).catch(() => {})
    api('/settings/admin')
      .then((s) => {
        setDeliveryFee(String(s.deliveryFee || 0))
        setShippingCost(String(s.shippingCostPerOrder || 0))
      })
      .catch(() => {})
  }, [])

  function chooseMode(isPast) {
    setPast(isPast)
    setStatus(isPast ? 'delivered' : 'new')
    setTakeStock(!isPast)
    setDone(null)
  }

  const setC = (k, v) => setCustomer((c) => ({ ...c, [k]: v }))
  const setItem = (i, patch) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  function pickProduct(i, id) {
    const p = products.find((x) => x._id === id)
    if (!p) return setItem(i, blankItem())
    const v = p.variants?.[0]
    setItem(i, {
      productId: id,
      variantName: v?.name || '',
      price: String(v?.price || p.price),
      cost: String(p.costPrice ?? 0),
    })
  }

  function pickVariant(i, name) {
    const p = products.find((x) => x._id === items[i].productId)
    const v = p?.variants?.find((x) => x.name === name)
    setItem(i, { variantName: name, price: String(v?.price || p?.price || '') })
  }

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const disc = Math.min(Number(discount) || 0, subtotal)
  const total = subtotal - disc + (Number(deliveryFee) || 0)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setDone(null)
    if (items.some((it) => !it.productId || it.price === '')) return setError('Choose a product and a price for every item.')
    if (past && !date) return setError('Choose the date of the past sale.')

    setBusy(true)
    try {
      const res = await api('/manual-orders', {
        method: 'POST',
        body: {
          customer: {
            name: customer.name,
            phone: customer.phone,
            area: AREAS.find((a) => a.id === customer.area)?.en,
            zone: customer.zone,
            street: customer.street,
            building: customer.building,
            address: customer.address,
            notes: customer.notes,
          },
          items: items.map((it) => ({
            productId: it.productId,
            variantName: it.variantName || undefined,
            qty: Number(it.qty),
            price: Number(it.price),
            cost: it.cost === '' ? undefined : Number(it.cost),
          })),
          deliveryFee: Number(deliveryFee) || 0,
          discount: disc,
          shippingCost: Number(shippingCost) || 0,
          status,
          source,
          date: past ? date : undefined,
          takeStock,
          adminNotes: adminNotes || undefined,
        },
      })
      setDone(res)
      setCustomer(blankCustomer)
      setItems([blankItem()])
      setDiscount('0')
      setAdminNotes('')
    } catch (err) {
      setError(err.details?.map((d) => `${d.field}: ${d.message}`).join(' · ') || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Register an order</h1>
        <p className="text-sm text-gray-500">For orders taken on WhatsApp, Messenger, or by phone, and for sales you made before the website existed.</p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => chooseMode(false)}
          className={`rounded-full px-5 py-2 text-sm font-medium ${!past ? 'bg-gray-900 text-white' : 'border bg-white hover:bg-gray-100'}`}>
          New order
        </button>
        <button type="button" onClick={() => chooseMode(true)}
          className={`rounded-full px-5 py-2 text-sm font-medium ${past ? 'bg-gray-900 text-white' : 'border bg-white hover:bg-gray-100'}`}>
          Past sale (already delivered)
        </button>
      </div>

      {past && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Past sale mode: the order gets the date you choose, is marked delivered, does <b>not</b> change today's stock, and sends no messages.
          Its revenue and profit appear on that date in your dashboard.
        </div>
      )}

      {done && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          Saved as <b>{done.orderNumber}</b> ({money(done.total)}). You can add the next one below.{' '}
          <Link to="/admin/orders" className="font-semibold underline">See orders</Link>
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <section className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:grid-cols-3">
        <Field label="Where did it come from?">
          <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {past && (
          <Field label="Date of the sale">
            <input type="date" required max={today()} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        <Field label="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-3">
          <input type="checkbox" checked={takeStock} onChange={(e) => setTakeStock(e.target.checked)} />
          Take these items from stock now
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Customer</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name *"><input required className={inputCls} value={customer.name} onChange={(e) => setC('name', e.target.value)} /></Field>
          <Field label={past ? 'Mobile (optional for old sales)' : 'Mobile *'}>
            <div className="flex" dir="ltr">
              <span className="grid place-items-center rounded-s-lg border border-e-0 bg-gray-50 px-3 text-sm text-gray-600">+974</span>
              <input inputMode="numeric" className={`${inputCls} rounded-s-none`} value={customer.phone}
                onChange={(e) => {
                  let d = e.target.value.replace(/\D/g, '')
                  if (d.startsWith('974') && d.length > 8) d = d.slice(3)
                  setC('phone', d.slice(0, 8))
                }} />
            </div>
          </Field>
          <Field label="Area">
            <select className={inputCls} value={customer.area} onChange={(e) => setC('area', e.target.value)}>
              <option value="">Select…</option>
              {AREAS.map((a) => <option key={a.id} value={a.id}>{a.en}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Zone"><input className={inputCls} value={customer.zone} onChange={(e) => setC('zone', e.target.value)} /></Field>
            <Field label="Street"><input className={inputCls} value={customer.street} onChange={(e) => setC('street', e.target.value)} /></Field>
            <Field label="Building"><input className={inputCls} value={customer.building} onChange={(e) => setC('building', e.target.value)} /></Field>
          </div>
          <Field label="Landmark / details" className="sm:col-span-2">
            <input className={inputCls} value={customer.address} onChange={(e) => setC('address', e.target.value)} />
          </Field>
          <Field label="Customer notes" className="sm:col-span-2">
            <input className={inputCls} value={customer.notes} onChange={(e) => setC('notes', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Items</h2>
          <button type="button" onClick={() => setItems((l) => [...l, blankItem()])}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"><Plus size={16} /> Add item</button>
        </div>

        {items.map((it, i) => {
          const p = products.find((x) => x._id === it.productId)
          return (
            <div key={i} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_9rem_4.5rem_6rem_6rem_auto]">
              <select className={inputCls} value={it.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">Choose product…</option>
                {products.map((x) => <option key={x._id} value={x._id}>{x.name.en} (stock {x.stock})</option>)}
              </select>
              {p?.variants?.length > 0 ? (
                <select className={inputCls} value={it.variantName} onChange={(e) => pickVariant(i, e.target.value)}>
                  {p.variants.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              ) : <div />}
              <input type="number" min="1" className={inputCls} value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} title="Quantity" />
              <input type="number" min="0" step="0.01" className={inputCls} value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} placeholder="Unit price" title="Unit price" />
              <input type="number" min="0" step="0.01" className={inputCls} value={it.cost} onChange={(e) => setItem(i, { cost: e.target.value })} placeholder="Unit cost" title="Your unit cost" />
              <button type="button" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}
                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button>
            </div>
          )
        })}
        <p className="text-xs text-gray-500">Per item: product, option, quantity, unit price, and your unit cost (filled from the product, change it for old sales).</p>
      </section>

      <section className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:grid-cols-4">
        <Field label="Delivery fee charged"><input type="number" min="0" className={inputCls} value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} /></Field>
        <Field label="Discount (amount)"><input type="number" min="0" className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
        <Field label="Your delivery cost"><input type="number" min="0" className={inputCls} value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} /></Field>
        <div className="self-end text-end">
          <div className="text-xs text-gray-500">Total to collect</div>
          <div className="text-2xl font-extrabold">{money(total)}</div>
        </div>
        <Field label="Private note" className="sm:col-span-4">
          <input className={inputCls} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </Field>
      </section>

      <button disabled={busy} className="rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-700 disabled:opacity-60">
        {busy ? 'Saving…' : past ? 'Save past sale' : 'Save order'}
      </button>
    </form>
  )
}