import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useStore } from '../storeContext'

export default function ProductFaq({ faqs }) {
  const { t, pick } = useStore()
  const [open, setOpen] = useState(0)

  const list = faqs?.length
    ? faqs.map((f) => ({ q: pick(f.q), a: pick(f.a) }))
    : [1, 2, 3].map((n) => ({ q: t(`faq${n}q`), a: t(`faq${n}a`) }))

  return (
    <section className="mx-auto mt-16 max-w-3xl">
      <h2 className="mb-6 text-center text-2xl font-bold">{t('faqTitle')}</h2>
      <div className="space-y-3">
        {list.map((f, i) => (
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