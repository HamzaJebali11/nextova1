import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useStore } from '../storeContext'
import Section from './Section'
import Reveal from './Reveal'

export default function ProductFaq({ faqs }) {
  const { t, pick } = useStore()
  const [open, setOpen] = useState(0)

  const list = faqs?.length
    ? faqs.map((f) => ({ q: pick(f.q), a: pick(f.a) }))
    : [1, 2, 3].map((n) => ({ q: t(`faq${n}q`), a: t(`faq${n}a`) }))

  return (
    <Section title={t('faqTitle')}>
      <div className="mx-auto max-w-3xl">
      <div className="divide-y divide-line">
        {list.map((f, i) => (
          <Reveal key={i} delay={Math.min(i, 5) * 0.06} className="overflow-hidden">
            <button onClick={() => setOpen(open === i ? -1 : i)}
              className="flex min-h-12 w-full items-center justify-between gap-3 py-4 text-start font-semibold">
              {f.q}
              <ChevronDown size={20} className={`shrink-0 transition duration-150 ${open === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <p className="pb-4 text-sm text-gray-600">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Reveal>
        ))}
      </div>
      </div>
    </Section>
  )
}