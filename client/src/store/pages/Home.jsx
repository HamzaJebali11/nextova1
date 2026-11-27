import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Banknote, ChevronDown, Truck } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'
import { usePageMeta } from '../../lib/seo'
import { WhatsAppIcon } from '../components/icons'
import ReviewCarousel from '../components/ReviewCarousel'
import Section from '../components/Section'
import ProductGrid from '../components/ProductGrid'
import Reveal from '../components/Reveal'
import HeroH1 from '../components/HeroH1'

// category tiles without a picture: black and grey tones only
const GRADS = [
  'from-gray-800 to-ink', 'from-gray-700 to-gray-900', 'from-gray-600 to-gray-800',
  'from-ink to-gray-700', 'from-gray-900 to-gray-600', 'from-gray-700 to-ink',
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

function TrustStrip() {
  const { t } = useStore()
  const items = [
    { icon: Truck, text: t('trustRowDelivery') },
    { icon: Banknote, text: t('codTitle') },
    { icon: WhatsAppIcon, text: t('supportTitle') },
  ]
  return (
    <div className="mt-4 border-b border-line bg-white">
      <ul className="nx-page flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-3 text-sm font-medium">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2"><Icon size={17} aria-hidden="true" /> {text}</li>
        ))}
      </ul>
    </div>
  )
}

function Categories() {
  const { t, pick, categories } = useStore()
  const top = categories.filter((c) => !c.parent)
  if (top.length === 0) return null
  return (
    <section id="categories" className="nx-page scroll-mt-28 pt-10 md:pt-12">
      <h2 className="mb-6 text-2xl font-bold tracking-tight">{t('shopByCategory')}</h2>
      <div className="flex flex-wrap justify-center gap-4">
        {top.map((c, i) => (
          <Reveal key={c._id} delay={(i % 4) * 0.06}
            className="basis-[calc(50%_-_0.5rem)] sm:basis-[calc(33.333%_-_0.67rem)] lg:basis-[calc(25%_-_0.75rem)] wide:basis-[calc(20%_-_0.8rem)] ultra:basis-[calc(16.666%_-_0.84rem)]">
            <Link to={`/shop?category=${c.slug}`}
              className={`nx-lift group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br shadow-e1 ${GRADS[i % GRADS.length]}`}>
              {c.image?.url && (
                <img src={optimizeImg(c.image.url, 500)} alt="" width={500} height={375}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-white">
                <span className="text-lg font-bold">{pick(c.name)}</span>
                <ArrowRight size={20} className="transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </div>
            </Link>
          </Reveal>
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
    <Section title={t('whatCustomersSay')}>
      <ReviewCarousel items={items.slice(0, 6)} showProduct />
    </Section>
  )
}

function Faq() {
  const { t } = useStore()
  const [open, setOpen] = useState(0)
  const faqs = [1, 2, 3].map((n) => ({ q: t(`faq${n}q`), a: t(`faq${n}a`) }))
  return (
    <Section title={t('faqTitle')}>
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <Reveal key={i} delay={i * 0.06} className="glass overflow-hidden rounded-2xl">
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}
              className="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-start font-semibold">
              {f.q}
              <ChevronDown size={20} className={`shrink-0 transition ${open === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <p className="max-w-[72ch] px-4 pb-4 text-sm text-gray-600">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

function WhatsAppBand() {
  const { t, settings } = useStore()
  if (!settings.whatsappNumber) return null
  return (
    <section className="nx-page mt-8 pb-12 md:mt-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 to-green-700 p-8 text-center text-white md:p-12">
        <div className="absolute -end-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -start-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative">
          <h2 className="text-2xl font-extrabold md:text-3xl">{t('supportTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-green-50">{t('supportSub')}</p>
          <a href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(t('whatsappHello'))}`}
            target="_blank" rel="noreferrer"
            className="glass-btn mt-6 gap-2 px-7 text-green-700">
            <WhatsAppIcon size={22} /> {t('chatWhatsapp')}
          </a>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { t, settings } = useStore()
  usePageMeta({ title: `${settings.storeName || 'Nextova'} | ${t('heroTitle')}`, description: t('heroSub') })
  const [all, setAll] = useState(null)

  useEffect(() => {
    let cancelled = false
    api('/products?limit=48')
      .then((d) => { if (!cancelled) setAll(d.items) })
      .catch(() => { if (!cancelled) setAll([]) })
    return () => { cancelled = true }
  }, [])

  const sections = all ? buildSections(all, t) : []

  return (
    <div>
      <HeroH1 />
      <TrustStrip />
      <Categories />

      {all === null && (
        <section className="nx-page py-10"><ProductGrid items={[]} loading count={4} /></section>
      )}
      {sections.map((s) => (
        <section key={s.key} className="nx-page pt-10 md:pt-12">
          <div className="mb-6 flex items-end justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
            <Link to={s.to} className="flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline">
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