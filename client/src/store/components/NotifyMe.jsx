import { useState } from 'react'
import { isValidQatarPhone, toLocalDigits } from '../../lib/phone'
import { Bell } from 'lucide-react'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'
import { friendlyError } from '../friendlyError'

const T = {
  en: {
    title: 'Sold out for now',
    sub: 'Leave your WhatsApp number and we will message you as soon as it is back.',
    phone: 'Mobile number',
    btn: 'Notify me',
    busy: 'Saving…',
    done: 'Done! We will message you on WhatsApp when it is back.',
    now: 'Good news: it is available now! Refresh the page to order.',
    err: 'Please enter a valid Qatar mobile number, for example 5xxxxxxx',
  },
  ar: {
    title: 'نفدت الكمية حاليًا',
    sub: 'اترك رقم واتساب الخاص بك وسنراسلك فور توفر المنتج.',
    phone: 'رقم الجوال',
    btn: 'أبلغني',
    busy: 'جارٍ الحفظ…',
    done: 'تم! سنراسلك عبر واتساب عند توفر المنتج.',
    now: 'خبر سار: المنتج متوفر الآن! حدّث الصفحة لتطلبه.',
    err: 'يرجى إدخال رقم جوال قطري صحيح، مثال: 5xxxxxxx',
  },
}

export default function NotifyMe({ productId, variantName }) {
  const { lang, t } = useStore()
  const x = T[lang] || T.en
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState('idle') // idle | busy | done | now
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!isValidQatarPhone(phone)) return setError(x.err)
    setState('busy')
    try {
      const res = await api('/alerts', {
        method: 'POST',
        body: { productId, variantName: variantName || undefined, phone, lang, website },
      })
      setState(res?.available ? 'now' : 'done')
    } catch (err) {
      setState('idle')
      setError(friendlyError(err, t, lang))
    }
  }

  return (
    <div className="glass relative rounded-2xl p-4 md:p-6">
      <div className="mb-1 flex items-center gap-2 font-bold text-ink">
        <Bell size={18} /> {x.title}
      </div>

      {state === 'done' || state === 'now' ? (
        <p className="text-sm font-medium text-ink">{state === 'done' ? x.done : x.now}</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="mb-3 text-sm text-ink">{x.sub}</p>
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website}
            onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          <div className="flex gap-2">
            <div className="flex flex-1" dir="ltr">
              <span className="glass-input grid place-items-center rounded-e-none border-e-0 px-3 text-sm text-gray-600">+974</span>
              <input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} placeholder={x.phone} aria-label={x.phone}
                onChange={(e) => setPhone(toLocalDigits(e.target.value))}
                className="glass-input w-full rounded-s-none px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <button disabled={state === 'busy'}
              className="btn-primary-glass min-h-11 rounded-xl px-5 text-sm">
              {state === 'busy' ? x.busy : x.btn}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}