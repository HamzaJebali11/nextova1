import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, MapPin } from 'lucide-react'
import { useStore } from '../storeContext'
import { usePageMeta } from '../../lib/seo'
import { WhatsAppIcon } from '../components/icons'
import Recommendations from '../components/Recommendations'

export default function OrderSuccess() {
  const { t, money, settings } = useStore()
  usePageMeta({ title: `${t('thankYou')} | ${settings.storeName || 'Nextova'}`, robots: 'noindex' })
  const [sp] = useSearchParams()
  const number = sp.get('n')
  const total = sp.get('t')

  if (!number) return <Navigate to="/" replace />

  // products of the order just placed (saved by the order form for this tab), left out of the row below
  let orderedIds = []
  try {
    const last = JSON.parse(sessionStorage.getItem('nx_last_order'))
    if (last?.n === number) orderedIds = last.ids || []
  } catch { /* none */ }

  const wa = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(t('locationMsg').replace('{num}', number))}`
    : null

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={56} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 className="text-2xl font-bold md:text-3xl">{t('thankYou')}</h1>

        <div className="mt-4 inline-block rounded-2xl bg-quiet px-6 py-4">
          <div className="text-sm text-gray-500">{t('orderNumber')}</div>
          <div className="text-2xl font-extrabold tracking-wide">{number}</div>
          {total && (
            <div className="mt-2 text-sm text-gray-600">
              {t('totalToPay')}: <b>{money(total)}</b>
            </div>
          )}
        </div>

        {/* the next step: the exact delivery location */}
        <div className="mt-6 rounded-3xl border-2 border-green-500 bg-green-50 p-6 text-start">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green-500 text-white">
              <MapPin size={22} />
            </span>
            <h2 className="text-lg font-bold text-green-900">{t('locationTitle')}</h2>
          </div>
          <p className="text-sm text-green-900">{t('locationSub')}</p>
          <p className="mt-2 text-sm font-medium text-green-800">{t('locationSteps')}</p>

          {wa && (
            <a href={wa} target="_blank" rel="noreferrer"
              className="nx-glow mt-4 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 font-semibold text-white">
              <WhatsAppIcon size={22} /> {t('sendLocation')}
            </a>
          )}
        </div>

        <p className="mt-5 text-sm text-gray-600">{t('successSub')}</p>

        <div className="mt-6">
          <Link to="/shop" className="inline-block rounded-full border px-8 py-3 font-medium hover:bg-quiet">
            {t('continueShopping')}
          </Link>
        </div>
      </motion.div>

      {/* Add more: goes into a NEW cart; the order just placed is not changed. No Purchase event here. */}
      <Recommendations exclude={orderedIds} title="moreDelivery" className="mt-10 text-start" />
    </div>
  )
}