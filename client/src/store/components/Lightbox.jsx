import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { optimizeImg } from '../../lib/image'

export default function Lightbox({ url, onClose }) {
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <button className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X size={22} />
      </button>
      <img src={optimizeImg(url, 1400)} alt="" onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
    </motion.div>
  )
}