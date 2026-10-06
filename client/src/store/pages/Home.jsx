import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Banknote, MessageCircle, Truck } from 'lucide-react'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'
import ProductGrid from '../components/ProductGrid'

function Row({ title, query, to }) {
  const { t } = useStore()
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    api(`/products?${query}`)
      .then((d) => { if (!cancelled) setItems(d.items) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [query])

  if (items && items.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        <Link to={to} className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline">
          {t('viewAll')} <ArrowRight size={16} className="rtl:rotate-180" />
        </Link>
      </div>
      <ProductGrid items={items || []} loading={!items} count={4} />
    </section>
  )
}

export default function Home() {
  const { t, pick, categories } = useStore()
  const top = categories.filter((c) => !c.parent)

  const perks = [
    { icon: Banknote, title: t('codTitle'), sub: t('codSub') },
    { icon: Truck, title: t('fastTitle'), sub: t('fastSub') },
    { icon: MessageCircle, title: t('supportTitle'), sub: t('supportSub') },
  ]

  return (
    <div>
      <section className="relative overflow-hidden bg-gray-900 text-white">
        <motion.div className="absolute -top-24 end-0 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl"
          animate={{ y: [0, 30, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute -bottom-24 start-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl"
          animate={{ y: [0, -30, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="max-w-2xl text-4xl font-extrabold leading-tight md:text-6xl">
            {t('heroTitle')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-4 max-w-xl text-lg text-gray-300">
            {t('heroSub')}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
            <Link to="/shop"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 font-semibold text-white transition hover:bg-emerald-400">
              {t('shopNow')} <ArrowRight size={18} className="rtl:rotate-180" />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-3">
        {perks.map(({ icon: Icon, title, sub }, i) => (
          <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className="flex items-center gap-4 rounded-2xl border bg-white p-5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon size={24} /></div>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-gray-500">{sub}</div>
            </div>
          </motion.div>
        ))}
      </section>

      {top.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-4">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">{t('shopByCategory')}</h2>
          <div className="flex flex-wrap gap-3">
            {top.map((c, i) => (
              <motion.div key={c._id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}>
                <Link to={`/shop?category=${c.slug}`}
                  className="block rounded-full border bg-white px-6 py-3 font-medium transition hover:border-emerald-500 hover:text-emerald-600">
                  {pick(c.name)}
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <Row title={t('featured')} query="featured=true&limit=8" to="/shop" />
      <Row title={t('onSale')} query="onSale=true&limit=4" to="/shop?onSale=true" />
      <Row title={t('newArrivals')} query="sort=newest&limit=8" to="/shop?sort=newest" />
    </div>
  )
}