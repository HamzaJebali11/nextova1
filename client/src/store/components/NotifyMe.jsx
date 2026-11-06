import { useState } from 'react'
import { Bell } from 'lucide-react'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'

const T = {
  en: {
    title: 'Sold out for now',
    sub: 'Leave your WhatsApp number and we will message you as soon as it is back.',
    phone: 'Mobile number',
    btn: 'Notify me',
    busy: 'Saving…',
    done: 'Done! We will message you on WhatsApp when it is back.',
    now: 'Good news: it is available now! Refresh the page to order.',
    err: 'Enter a valid Qatar mobile number (8 digits)',
  },
  ar: {
    title: 'نفدت الكمية حاليًا',
    sub: 'اترك رقم واتساب الخاص بك وسنراسلك فور توفر المنتج.',
    phone: 'رقم الجوال',
    btn: 'أبلغني',
    busy: 'جارٍ الحفظ…',
    done: 'تم! سنراسلك عبر واتساب عند توفر المنتج.',
    now: 'خبر سار: المنتج متوفر الآن! حدّث الصفحة لتطلبه.',
    err: 'أدخل رقم جوال قطري صحيح (8 أرقام)',
  },
}

export default function NotifyMe({ productId, variantName }) {
  const { lang } = useStore()
  const x = T[lang] || T.en
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState('idle') // idle | busy | done | now
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!/^[3567]\d{7}$/.test(phone)) return setError(x.err)
    setState('busy')
    try {
      const res = await api('/alerts', {
        method: 'POST',
        body: { productId, variantName: variantName || undefined, phone, lang, website },
      })
      setState(res?.available ? 'now' : 'done')
    } catch (err) {
      setState('idle')
      setError(err.details?.map((d) => d.message).join(' · ') || err.message)
    }
  }

  return (
    <div className="relative mt-5 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 p-5">
      <div className="mb-1 flex items-center gap-2 font-bold text-amber-900">
        <Bell size={18} /> {x.title}
      </div>

      {state === 'done' || state === 'now' ? (
        <p className="text-sm font-medium text-green-700">{state === 'done' ? x.done : x.now}</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="mb-3 text-sm text-amber-900">{x.sub}</p>
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website}
            onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          <div className="flex gap-2">
            <div className="flex flex-1" dir="ltr">
              <span className="grid place-items-center rounded-s-xl border border-e-0 bg-white px-3 text-sm text-gray-600">+974</span>
              <input type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} placeholder={x.phone}
                onChange={(e) => {
                  let d = e.target.value.replace(/\D/g, '')
                  if (d.startsWith('974') && d.length > 8) d = d.slice(3)
                  setPhone(d.slice(0, 8))
                }}
                className="w-full rounded-e-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <button disabled={state === 'busy'}
              className="rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60">
              {state === 'busy' ? x.busy : x.btn}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}