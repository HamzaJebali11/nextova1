import { useEffect, useMemo, useState } from 'react'
import { CartCtx } from './cartContext'
import { repriceCart } from '../lib/pricing'

const KEY = 'nx_cart'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

// adds lines (each with its own qty); the same product + variant becomes one line
function merge(prev, lines) {
  let next = [...prev]
  for (const line of lines) {
    const key = `${line.productId}|${line.variantName || ''}`
    const found = next.find((i) => i.key === key)
    if (found) {
      next = next.map((i) =>
        i.key === key ? { ...i, ...line, key, qty: Math.min(20, i.qty + line.qty) } : i
      )
    } else {
      next.push({ ...line, key, qty: Math.min(20, line.qty) })
    }
  }
  return repriceCart(next)
}

// Prices here are for display only: the server recalculates everything when an order is placed.
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => repriceCart(read()))
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
    add: (item, qty = 1) => setItems((prev) => merge(prev, [{ ...item, qty }])),
    addMany: (lines) => setItems((prev) => merge(prev, lines)),
    setQty: (key, qty) =>
      setItems((prev) =>
        repriceCart(prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(20, qty)) } : i)))
      ),
    remove: (key) => setItems((prev) => repriceCart(prev.filter((i) => i.key !== key))),
    clear: () => setItems([]),
  }), [items, open])

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}