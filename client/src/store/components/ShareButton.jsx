import { useSearchParams } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { useStore } from '../storeContext'
import { trackCustom } from '../../lib/pixel'
import { WhatsAppIcon } from './icons'

// "Share on WhatsApp" (neutral outline button, product pages only).
// Phones: the system share sheet when the browser has one; otherwise WhatsApp with the product name,
// the price of the main pack and the product link (?utm_source=share, keeping ?angle=).
export default function ShareButton({ product }) {
  const { t, pick, money } = useStore()
  const [sp] = useSearchParams()

  function mainPrice() {
    const packs = product.packs || []
    const main = packs.find((p) => pick(p.badge)) || packs[0]
    if (main && main.qty > 1) return `${main.qty} × ${money(main.price / main.qty)} = ${money(main.price)}`
    return money(main?.price || product.price)
  }

  async function share() {
    const url = new URL(`/product/${product.slug}`, window.location.origin)
    url.searchParams.set('utm_source', 'share')
    const angle = sp.get('angle') || sp.get('a')
    if (angle) url.searchParams.set('angle', angle)
    const name = pick(product.name)
    const text = `${name} · ${mainPrice()}`
    const phone = window.matchMedia?.('(pointer: coarse)').matches
    let method = 'whatsapp'
    if (phone && navigator.share) {
      method = 'native'
      trackCustom('Share', { content_ids: [product._id], content_name: name, method })
      try { await navigator.share({ title: name, text, url: url.toString() }) } catch { /* closed by the visitor */ }
      return
    }
    trackCustom('Share', { content_ids: [product._id], content_name: name, method })
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener')
  }

  return (
    <button type="button" onClick={share}
      className="nx-share flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink">
      <WhatsAppIcon size={17} className="nx-share-icon" aria-hidden="true" />
      {t('shareWhatsApp')}
      <Share2 size={15} aria-hidden="true" className="opacity-60" />
    </button>
  )
}
