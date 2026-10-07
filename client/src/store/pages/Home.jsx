import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Banknote, ChevronDown, Truck } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { WhatsAppIcon } from '../components/icons'
import ReviewCarousel from '../components/ReviewCarousel'
import ProductGrid from '../components/ProductGrid'

const GRADS = [
  'from-emerald-500 to-teal-700', 'from-sky-500 to-indigo-700', 'from-amber-500 to-orange-700',
  'from-fuchsia-500 to-purple-700', 'from-rose-500 to-red-700', 'from-lime-500 to-green-700',
]

function buildSections(all, t) {
  if (all.length === 0) return []
  if (all.length <= 8) return [{ key: 'all', title: t('allProducts'), items: all, to: '/shop' }]

  const shown = new Set()
  const take = (list, n) => {
    const out = list.filter((p) => !shown.has(p._id)).slice(0, n)
    out.forEach((p) => shown.add(p._id))
    return out
  }
  return [
    { key: 'featured', title: t('featured'), items: take(all.filter((p) => p.isFeatured), 8), to: '/shop' },
    { key: 'sale', title: t('onSale'), items: take(all.filter((p) => p.compareAtPrice > p.price), 8), to: '/shop?onSale=true' },
    { key: 'popular', title: t('popular'), items: take([...all].filter((p) => p.soldCount > 0).sort((a, b) => b.soldCount - a.soldCount), 8), to: '/shop?sort=popular' },
    { key: 'new', title: t('newArrivals'), items: take(all, 8), to: '/shop?sort=newest' },
  ].filter((s) => s.items.length > 0)
}

function HeroVisual({ products }) {
  const { pick } = useStore()
  const imgs = products.filter((p) => p.images?.[0]?.url).slice(0, 3)
  if (imgs.length === 0) return null
  const spots = [
    'start-0 top-6 w-44 -rotate-6 md:w-52',
    'end-0 top-0 w-40 rotate-6 md:w-48',
    'start-1/3 bottom-0 w-44 rotate-2 md:w-56',
  ]
  return (
    <div className="relative mx-auto hidden h-[26rem] w-full max-w-md md:block">
      {imgs.map((p, i) => (
        <motion.div key={p._id} className={`absolute ${spots[i]} overflow-hidden rounded-3xl border-4 border-white/20 shadow-2xl`}
          animate={{ y: [0, i % 2 ? 14 : -14, 0] }}
          transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut' }}>
          <Link to={`/product/${p.slug}`}>
            <img src={optimizeImg(p.images[0].url, 400)} alt={pick(p.name)} className="aspect-square w-full object-cover" />
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

function Hero({ products }) {
  const { t } = useStore()
  const hasVisual = products.some((p) => p.images?.[0]?.url)
  return (
    <section className="relative overflow-hidden bg-gray-900 text-white">
      <motion.div className="absolute -top-24 end-0 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl"
        animate={{ y: [0, 30, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute -bottom-24 start-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl"
        animate={{ y: [0, -30, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />

      <div className={`relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:py-24 ${hasVisual ? 'md:grid-cols-2' : 'text-center'}`}>
        <div className={hasVisual ? '' : 'mx-auto max-w-3xl'}>
          <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-white/15">
            <Banknote size={16} /> {t('heroBadge')}
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 text-4xl font-extrabold leading-tight md:text-6xl">
            {t('heroTitle')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className={`mt-4 max-w-xl text-lg text-gray-300 ${hasVisual ? '' : 'mx-auto'}`}>
            {t('heroSub')}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className={`mt-8 flex flex-wrap gap-3 ${hasVisual ? '' : 'justify-center'}`}>
            <Link to="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 font-semibold text-white transition hover:bg-emerald-400">
              {t('shopNow')} <ArrowRight size={18} className="rtl:rotate-180" />
            </Link>
            <a href="#categories"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-semibold transition hover:bg-white/10">
              {t('heroSecondary')}
            </a>
          </motion.div>
        </div>
        <HeroVisual products={products} />
      </div>
    </section>
  )
}

function Marquee() {
  const { t } = useStore()
  const items = [
    { icon: Banknote, text: t('codTitle') },
    { icon: Truck, text: `${t('fastTitle')} · ${t('fastSub')}` },
    { icon: WhatsAppIcon, text: t('supportTitle') },
  ]
  const group = (k) => (
    <div key={k} className="flex shrink-0 items-center gap-12 pe-12">
      {[0, 1, 2].flatMap((r) =>
        items.map(({ icon: Icon, text }, i) => (
          <span key={`${r}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
            <Icon size={18} /> {text}
          </span>
        ))
      )}
    </div>
  )
  return (
    <div dir="ltr" className="overflow-hidden bg-emerald-600 py-3 text-white">
      <div className="nx-marquee flex w-max">{group('a')}{group('b')}</div>
    </div>
  )
}

function Perks() {
  const { t } = useStore()
  const perks = [
    { icon: Banknote, title: t('codTitle'), sub: t('codSub') },
    { icon: Truck, title: t('fastTitle'), sub: t('fastSub') },
    { icon: WhatsAppIcon, title: t('supportTitle'), sub: t('supportSub') },
  ]
  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-3">
      {perks.map(({ icon: Icon, title, sub }, i) => (
        <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: i * 0.1 }}
          className="flex items-center gap-4 rounded-3xl border bg-white p-5 transition hover:shadow-lg">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon size={24} /></div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-gray-500">{sub}</div>
          </div>
        </motion.div>
      ))}
    </section>
  )
}

function Categories() {
  const { t, pick, categories } = useStore()
  const top = categories.filter((c) => !c.parent)
  if (top.length === 0) return null
  return (
    <section id="categories" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-6">
      <h2 className="mb-5 text-2xl font-bold md:text-3xl">{t('shopByCategory')}</h2>
      <div className="flex flex-wrap justify-center gap-4">
        {top.map((c, i) => (
          <motion.div key={c._id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ delay: i * 0.05 }}
            className="basis-[calc(50%_-_0.5rem)] md:basis-[calc(25%_-_0.75rem)]">
            <Link to={`/shop?category=${c.slug}`}
              className={`group relative block aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br ${GRADS[i % GRADS.length]}`}>
              {c.image?.url && (
                <img src={optimizeImg(c.image.url, 500)} alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-white">
                <span className="text-lg font-bold">{pick(c.name)}</span>
                <ArrowRight size={20} className="transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function HomeReviews() {
  const { t } = useStore()
  const [items, setItems] = useState([])

  useEffect(() => {
    let cancelled = false
    api('/reviews/latest').then((d) => { if (!cancelled) setItems(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (items.length === 0) return null
  return (
    <section className="bg-gray-50 py-14">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">{t('whatCustomersSay')}</h2>
        <ReviewCarousel items={items} showProduct />
      </div>
    </section>
  )
}

function Faq() {
  const { t } = useStore()
  const [open, setOpen] = useState(0)
  const faqs = [1, 2, 3].map((n) => ({ q: t(`faq${n}q`), a: t(`faq${n}a`) }))
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h2 className="mb-6 text-center text-2xl font-bold md:text-3xl">{t('faqTitle')}</h2>
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-white">
            <button onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between gap-3 p-4 text-start font-semibold">
              {f.q}
              <ChevronDown size={20} className={`shrink-0 transition ${open === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <p className="px-4 pb-4 text-sm text-gray-600">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

function WhatsAppBand() {
  const { t, settings } = useStore()
  if (!settings.whatsappNumber) return null
  return (
    <section className="mx-auto max-w-7xl px-4 pb-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-500 to-green-700 p-8 text-center text-white md:p-12">
        <div className="absolute -end-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -start-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative">
          <h2 className="text-2xl font-extrabold md:text-3xl">{t('supportTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-green-50">{t('supportSub')}</p>
          <a href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(t('whatsappHello'))}`}
            target="_blank" rel="noreferrer"
            className="nx-glow mt-6 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-green-700">
            <WhatsAppIcon size={22} /> {t('chatWhatsapp')}
          </a>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { t } = useStore()
  const [all, setAll] = useState(null)

  useEffect(() => {
    let cancelled = false
    api('/products?limit=48')
      .then((d) => { if (!cancelled) setAll(d.items) })
      .catch(() => { if (!cancelled) setAll([]) })
    return () => { cancelled = true }
  }, [])

  const sections = all ? buildSections(all, t) : []
  const heroProducts = all ? [...all.filter((p) => p.isFeatured), ...all].filter((p, i, a) => a.indexOf(p) === i) : []

  return (
    <div>
      <Hero products={heroProducts} />
      <Marquee />
      <Perks />
      <Categories />

      {all === null && (
        <section className="mx-auto max-w-7xl px-4 py-10"><ProductGrid items={[]} loading count={4} /></section>
      )}
      {sections.map((s) => (
        <section key={s.key} className="mx-auto max-w-7xl px-4 py-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-bold md:text-3xl">{s.title}</h2>
            <Link to={s.to} className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline">
              {t('viewAll')} <ArrowRight size={16} className="rtl:rotate-180" />
            </Link>
          </div>
          <ProductGrid items={s.items} loading={false} />
        </section>
      ))}

      <HomeReviews />
      <Faq />
      <WhatsAppBand />
    </div>
  )
}