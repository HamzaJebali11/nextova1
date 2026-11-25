import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { buildReceipt } from '../../lib/receipt'
import { locationMessage } from '../../lib/messages'
import { WhatsAppIcon } from '../../store/components/icons'

export default function ReceiptPanel({ order }) {
  const [storeName, setStoreName] = useState('Nextova')

  useEffect(() => {
    api('/settings').then((s) => s.storeName && setStoreName(s.storeName)).catch(() => {})
  }, [])

  if (['cancelled', 'returned'].includes(order.status)) return null

  const phone = order.customer.phone.replace(/\D/g, '')
  const open = (text) => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')

  const btn =
    'flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:brightness-110'

  if (order.status === 'delivered') {
    const send = (lang) =>
      open(buildReceipt(order, { lang, storeName, siteUrl: window.location.origin }))
    return (
      <section className="mb-5 rounded-xl border-2 border-green-500 bg-green-50 p-4">
        <h3 className="mb-1 font-semibold text-green-800">Order delivered 🎉</h3>
        <p className="mb-3 text-xs text-green-700">
          Send the customer their receipt on WhatsApp. WhatsApp opens with the message ready, you just press send.
          It also asks for a review, which builds your reviews.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => send('en')} className={btn}><WhatsAppIcon size={18} /> Receipt (English)</button>
          <button onClick={() => send('ar')} className={btn}><WhatsAppIcon size={18} /> الإيصال (عربي)</button>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-5 rounded-xl border bg-green-50/60 p-4">
      <h3 className="mb-1 font-semibold text-green-800">Ask for the delivery location</h3>
      <p className="mb-3 text-xs text-green-700">
        One tap opens WhatsApp with a ready message asking the customer to send their exact location.
        Use it if the customer has not sent it yet.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => open(locationMessage(order, 'en', storeName))} className={btn}>
          <WhatsAppIcon size={18} /> Ask (English)
        </button>
        <button onClick={() => open(locationMessage(order, 'ar', storeName))} className={btn}>
          <WhatsAppIcon size={18} /> اطلب الموقع (عربي)
        </button>
      </div>
    </section>
  )
}