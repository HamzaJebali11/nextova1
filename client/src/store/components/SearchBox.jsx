import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { api } from '../../lib/api'
import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'

export default function SearchBox() {
  const { t, pick, money } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      api(`/products?q=${encodeURIComponent(q.trim())}&limit=5`)
        .then((d) => { if (!cancelled) setRes(d.items) })
        .catch(() => {})
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q])

  const show = open && q.trim().length >= 2 && res.length > 0

  function submit(e) {
    e.preventDefault()
    if (!q.trim()) return
    setOpen(false)
    navigate(`/shop?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="relative">
      <form onSubmit={submit} className="relative">
        <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-full border bg-gray-50 py-2 ps-10 pe-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200" />
      </form>

      <AnimatePresence>
        {show && (
          <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-white shadow-xl">
            {res.map((p) => (
              <li key={p._id}>
                <Link to={`/product/${p.slug}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50">
                  <img src={optimizeImg(p.images?.[0]?.url, 100)} alt="" className="h-10 w-10 rounded-lg bg-gray-100 object-cover" />
                  <span className="flex-1 truncate text-sm font-medium">{pick(p.name)}</span>
                  <span className="text-sm text-gray-600">{money(p.price)}</span>
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}