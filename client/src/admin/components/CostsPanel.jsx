import { api } from '../../lib/api'
import { money } from '../../lib/constants'

export default function CostsPanel({ order, onChanged }) {
  const cogs = order.items.reduce((s, i) => s + (i.cost || 0) * i.qty, 0)
  const ship = order.shippingCost || 0
  const profit = order.total - cogs - ship

  async function save(v) {
    try {
      onChanged(await api(`/orders/${order._id}/costs`, { method: 'PATCH', body: { shippingCost: v } }))
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <section className="mb-5 rounded-xl bg-gray-50 p-4 text-sm">
      <h3 className="mb-2 font-semibold">Profit on this order</h3>
      <div className="space-y-1">
        <div className="flex justify-between"><span>Revenue (incl. delivery fee)</span><span>{money(order.total)}</span></div>
        <div className="flex justify-between"><span>Product cost</span><span>− {money(cogs)}</span></div>
        <div className="flex items-center justify-between">
          <span>Shipping cost (what you pay)</span>
          <input key={ship} type="number" min="0" defaultValue={ship}
            onBlur={(e) => { const n = Number(e.target.value); if (e.target.value !== '' && n !== ship) save(n) }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-20 rounded-lg border px-2 py-1 text-end outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div className={`flex justify-between border-t pt-2 font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <span>Profit before ads</span><span>{money(profit)}</span>
        </div>
      </div>
    </section>
  )
}