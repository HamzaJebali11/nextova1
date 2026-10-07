import { motion } from 'framer-motion'
import { useStore } from '../storeContext'
import { WhatsAppIcon } from './icons'

export default function WhatsAppButton() {
  const { settings, t } = useStore()
  if (!settings.whatsappNumber) return null
  const href = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(t('whatsappHello'))}`

  return (
    <motion.a href={href} target="_blank" rel="noreferrer" aria-label={t('chatWhatsapp')}
      initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', delay: 0.6 }}
      className="group fixed bottom-5 end-5 z-40 h-16 w-16">
      <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/40" />
      <span className="nx-glow relative grid h-16 w-16 place-items-center rounded-full bg-[#25D366] text-white">
        <WhatsAppIcon size={34} />
      </span>
      <span className="pointer-events-none absolute end-full top-1/2 me-3 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-sm font-medium text-gray-800 opacity-0 shadow-lg transition group-hover:opacity-100">
        {t('chatWhatsapp')}
      </span>
    </motion.a>
  )
}