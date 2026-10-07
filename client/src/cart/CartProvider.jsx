import { useEffect, useMemo, useState } from 'react'
import { CartCtx } from './cartContext'
import { bestTotal } from '../lib/pricing'

const KEY = 'nx_cart'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

// Unit price after pack offers. Display only: the server recalculates everything when an order is placed.
function reprice(item) {
  const base = item.base ?? item.price
  const total = bestTotal(item.qty, base, item.packs || [])
  return { ...item, base, price: total / item.qty }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(read)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  const value = useMemo(() => ({
    items,
    open,
    setOpen,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100,
    add: (item, qty = 1) =>
      setItems((prev) => {
        const key = `${item.productId}|${item.variantName || ''}`
        const found = prev.find((i) => i.key === key)
        if (found) {
          return prev.map((i) =>
            i.key === key ? reprice({ ...i, ...item, qty: Math.min(20, i.qty + qty) }) : i
          )
        }
        return [...prev, reprice({ ...item, key, qty })]
      }),
    setQty: (key, qty) =>
      setItems((prev) =>
        prev.map((i) => (i.key === key ? reprice({ ...i, qty: Math.max(1, Math.min(20, qty)) }) : i))
      ),
    remove: (key) => setItems((prev) => prev.filter((i) => i.key !== key)),
    clear: () => setItems([]),
  }), [items, open])

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}