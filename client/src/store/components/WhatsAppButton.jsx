import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import { useStore } from '../storeContext'

export default function WhatsAppButton() {
  const { settings, t } = useStore()
  if (!settings.whatsappNumber) return null
  const href = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(t('whatsappHello'))}`

  return (
    <motion.a href={href} target="_blank" rel="noreferrer" aria-label={t('chatWhatsapp')}
      initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', delay: 0.6 }}
      className="fixed bottom-5 end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-green-500 text-white shadow-lg">
      <MessageCircle size={28} />
    </motion.a>
  )
}