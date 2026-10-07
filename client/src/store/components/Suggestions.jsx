import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'
import ProductGrid from './ProductGrid'

export default function Suggestions() {
  const { t } = useStore()
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    api('/products?sort=popular&limit=4')
      .then((d) => { if (!cancelled) setItems(d.items) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!items || items.length === 0) return null
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-bold">{t('popular')}</h2>
      <ProductGrid items={items} loading={false} compact />
    </section>
  )
}